#!/usr/bin/env node

export async function collectPageInsights(page) {
  return page.evaluate(() => {
    const maxTextSamples = 10;
    const maxMediaSamples = 12;
    const maxColorEntries = 10;

    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number.parseFloat(style.opacity || '1') > 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const toHex = (color) => {
      if (!color || color === 'transparent') {
        return null;
      }

      const match = color.match(/rgba?\(([^)]+)\)/i);
      if (!match) {
        return null;
      }

      const parts = match[1].split(',').map((part) => part.trim());
      if (parts.length < 3) {
        return null;
      }

      const alpha = parts[3] === undefined ? 1 : Number.parseFloat(parts[3]);
      if (Number.isFinite(alpha) && alpha === 0) {
        return null;
      }

      const rgb = parts.slice(0, 3).map((part) => {
        const numeric = Number.parseFloat(part);
        const clamped = Math.max(0, Math.min(255, Math.round(numeric)));
        return clamped.toString(16).padStart(2, '0');
      });

      return `#${rgb.join('')}`;
    };

    const normalizeFontFamily = (fontFamily) => {
      if (!fontFamily || typeof fontFamily !== 'string') {
        return null;
      }

      const families = fontFamily
        .split(',')
        .map((part) => part.replace(/['"]/g, '').trim())
        .filter(Boolean);

      return families[0] || null;
    };

    const summarizeCounts = (map) => {
      return Object.entries(map)
        .sort((left, right) => {
          if (right[1] !== left[1]) {
            return right[1] - left[1];
          }
          return left[0].localeCompare(right[0]);
        })
        .slice(0, maxColorEntries)
        .map(([value, count]) => ({ value, count }));
    };

    const pushCount = (map, key) => {
      if (!key) {
        return;
      }
      map[key] = (map[key] || 0) + 1;
    };

    const dedupeObjects = (items, keyFn) => {
      const results = [];
      const seen = new Set();
      for (const item of items) {
        const key = keyFn(item);
        if (!key || seen.has(key)) {
          continue;
        }
        seen.add(key);
        results.push(item);
      }
      return results;
    };

    const collectTextSamples = (selector, role) => {
      const nodes = Array.from(document.querySelectorAll(selector))
        .filter((element) => isVisible(element))
        .map((element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
          return {
            role,
            text: text.slice(0, 120),
            fontFamily: normalizeFontFamily(style.fontFamily),
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
            letterSpacing: style.letterSpacing,
            textTransform: style.textTransform,
            color: toHex(style.color),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            area: Math.round(rect.width * rect.height),
          };
        })
        .filter((sample) => sample.text && sample.text.length > 1)
        .sort((left, right) => right.area - left.area);

      return dedupeObjects(nodes, (item) => [
        item.fontFamily,
        item.fontSize,
        item.fontWeight,
        item.textTransform,
      ].join('|')).slice(0, maxTextSamples);
    };

    const loadedFonts = dedupeObjects(
      Array.from(document.fonts || [])
        .map((fontFace) => ({
          family: (fontFace.family || '').replace(/['"]/g, '').trim(),
          weight: String(fontFace.weight || '').trim(),
          style: String(fontFace.style || '').trim(),
          status: String(fontFace.status || '').trim(),
        }))
        .filter((fontFace) => fontFace.family && !fontFace.family.toLowerCase().includes('fallback')),
      (item) => `${item.family}|${item.weight}|${item.style}`
    ).slice(0, 12);

    const textColorCounts = {};
    const surfaceColorCounts = {};
    const borderColorCounts = {};
    const gradientNotes = [];
    const accentCandidateCounts = {};

    const elements = Array.from(document.querySelectorAll('body *')).filter((element) => isVisible(element));

    for (const element of elements.slice(0, 1200)) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const area = rect.width * rect.height;
      const textColor = toHex(style.color);
      const backgroundColor = toHex(style.backgroundColor);
      const borderColor = toHex(style.borderColor);
      const backgroundImage = style.backgroundImage || '';
      const tagName = element.tagName.toLowerCase();
      const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
      const isButtonLike = tagName === 'button' || tagName === 'a' || element.getAttribute('role') === 'button';
      const isTextBearing = text.length > 0 && text.length < 180;

      if (isTextBearing) {
        pushCount(textColorCounts, textColor);
      }

      if (backgroundColor && area >= 5000 && !isButtonLike) {
        pushCount(surfaceColorCounts, backgroundColor);
      }

      if (style.borderStyle !== 'none' && parseFloat(style.borderWidth || '0') > 0 && area >= 5000) {
        pushCount(borderColorCounts, borderColor);
      }

      if (backgroundImage.includes('gradient')) {
        const note = backgroundImage.replace(/\s+/g, ' ').slice(0, 180);
        if (note && !gradientNotes.includes(note)) {
          gradientNotes.push(note);
        }
      }

      if (isButtonLike && backgroundColor && text.length > 0 && text.length <= 80 && rect.width >= 48 && rect.height >= 20) {
        const accentKey = `${backgroundColor}|${textColor || ''}|${text.slice(0, 60)}`;
        const existing = accentCandidateCounts[accentKey] || {
          value: backgroundColor,
          textColor,
          label: text.slice(0, 60),
          fontFamily: normalizeFontFamily(style.fontFamily),
          count: 0,
        };
        existing.count += 1;
        accentCandidateCounts[accentKey] = existing;
      }
    }

    const mediaSamples = [];
    const mediaNodes = Array.from(document.querySelectorAll('img, svg, canvas, picture'))
      .filter((element) => isVisible(element))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element,
          area: rect.width * rect.height,
        };
      })
      .sort((left, right) => right.area - left.area);

    for (const item of mediaNodes.slice(0, maxMediaSamples)) {
      const element = item.element;
      const rect = element.getBoundingClientRect();
      const tag = element.tagName.toLowerCase();
      const alt = element.getAttribute('alt') || element.getAttribute('aria-label') || '';
      const src = tag === 'img'
        ? (element.getAttribute('src') || '')
        : tag === 'picture'
          ? ''
          : '';
      mediaSamples.push({
        kind: tag,
        alt: alt.trim().slice(0, 120),
        src: src.trim().slice(0, 160),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        area: Math.round(rect.width * rect.height),
      });
    }

    const backgroundImageSamples = [];
    for (const element of elements) {
      const style = window.getComputedStyle(element);
      const backgroundImage = style.backgroundImage || '';
      if (!backgroundImage || backgroundImage === 'none' || backgroundImage.includes('gradient')) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      if (rect.width * rect.height < 20000) {
        continue;
      }
      backgroundImageSamples.push({
        kind: 'background-image',
        value: backgroundImage.replace(/\s+/g, ' ').slice(0, 180),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
      if (backgroundImageSamples.length >= 6) {
        break;
      }
    }

    return {
      loadedFonts,
      typography: {
        headings: collectTextSamples('h1, h2, h3, h4, h5, h6, [role=\"heading\"]', 'heading'),
        body: collectTextSamples('p, li, blockquote', 'body'),
        ui: collectTextSamples('button, a, label, nav a, [role=\"button\"]', 'ui'),
      },
      colors: {
        textColors: summarizeCounts(textColorCounts),
        surfaceColors: summarizeCounts(surfaceColorCounts),
        borderColors: summarizeCounts(borderColorCounts),
        accentCandidates: Object.values(accentCandidateCounts)
          .sort((left, right) => {
            if (right.count !== left.count) {
              return right.count - left.count;
            }
            return left.value.localeCompare(right.value);
          })
          .slice(0, 10),
        gradients: gradientNotes.slice(0, 8),
      },
      illustrations: {
        mediaSummary: {
          imgCount: mediaNodes.filter((node) => node.element.tagName.toLowerCase() === 'img').length,
          svgCount: mediaNodes.filter((node) => node.element.tagName.toLowerCase() === 'svg').length,
          canvasCount: mediaNodes.filter((node) => node.element.tagName.toLowerCase() === 'canvas').length,
          pictureCount: mediaNodes.filter((node) => node.element.tagName.toLowerCase() === 'picture').length,
          backgroundImageCount: backgroundImageSamples.length,
        },
        mediaSamples,
        backgroundImageSamples,
      },
    };
  });
}

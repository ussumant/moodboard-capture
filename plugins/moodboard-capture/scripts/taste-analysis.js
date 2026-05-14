#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import {
  buildFallbackDesignSystemExtraction,
  normalizeDesignFacets,
  normalizeDesignSystemExtraction,
} from './design-system.js';

const defaultOpenAIModel = 'gpt-4.1-mini';
const supportedAnalysisModes = new Set(['auto', 'mock', 'fail']);

/**
 * @typedef {Object} TasteProfileContribution
 * @property {string[]} preferredTypography
 * @property {string[]} preferredPalettes
 * @property {string[]} preferredCompositions
 * @property {string[]} preferredMoods
 * @property {string[]} preferredMaterials
 * @property {string[]} recurringThemes
 * @property {string[]} avoidedPatterns
 */

/**
 * @typedef {Object} TasteAnalysis
 * @property {Object} visualTraits
 * @property {string} whyItWorks
 * @property {string[]} designSignals
 * @property {TasteProfileContribution} profileContributions
 * @property {string} summary
 */

/**
 * @typedef {Object} CaptureAnalysisResult
 * @property {TasteAnalysis} tasteAnalysis
 * @property {Object} designSystemExtraction
 */

export async function analyzeCaptureTaste({
  assetPath,
  sourceType,
  sourceUrl,
  userNote,
  tags,
  whyLiked,
  styleCues,
  facets,
  observedEvidence,
}) {
  const mode = resolveAnalysisMode();
  const normalizedFacets = normalizeDesignFacets(facets);

  if (mode === 'fail') {
    throw new Error('Simulated taste analysis failure.');
  }

  if (mode === 'mock') {
    return buildMockAnalysis({
      assetPath,
      sourceType,
      sourceUrl,
      userNote,
      tags,
      whyLiked,
      styleCues,
      facets: normalizedFacets,
      observedEvidence,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  return analyzeWithOpenAI({
    apiKey,
    assetPath,
    sourceType,
    sourceUrl,
    userNote,
    tags,
    whyLiked,
    styleCues,
    facets: normalizedFacets,
    observedEvidence,
  });
}

function resolveAnalysisMode() {
  const requestedMode = (process.env.MOODBOARD_CAPTURE_ANALYSIS_MODE || 'auto').toLowerCase();
  if (supportedAnalysisModes.has(requestedMode)) {
    return requestedMode;
  }
  return 'auto';
}

async function analyzeWithOpenAI({
  apiKey,
  assetPath,
  sourceType,
  sourceUrl,
  userNote,
  tags,
  whyLiked,
  styleCues,
  facets,
  observedEvidence,
}) {
  const imageDataUrl = await buildImageDataUrl(assetPath);
  const prompt = buildAnalysisPrompt({
    sourceType,
    sourceUrl,
    userNote,
    tags,
    whyLiked,
    styleCues,
    facets,
    observedEvidence,
  });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.MOODBOARD_CAPTURE_OPENAI_MODEL || process.env.OPENAI_MODEL || defaultOpenAIModel,
      response_format: {
        type: 'json_object',
      },
      messages: [
        {
          role: 'system',
          content: 'You are a design taste analyst and design-system extractor. Return strict JSON only.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI analysis request failed (${response.status}): ${truncate(errorText, 300)}`);
  }

  const payload = await response.json();
  const rawContent = payload?.choices?.[0]?.message?.content;

  if (!rawContent || typeof rawContent !== 'string') {
    throw new Error('OpenAI analysis response did not include JSON content.');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error('OpenAI analysis response was not valid JSON.');
  }

  return normalizeCaptureAnalysis(parsed, {
    sourceType,
    sourceUrl,
    userNote,
    tags,
    whyLiked,
    styleCues,
    facets,
    observedEvidence,
  });
}

function buildAnalysisPrompt({
  sourceType,
  sourceUrl,
  userNote,
  tags,
  whyLiked,
  styleCues,
  facets,
  observedEvidence,
}) {
  const lines = [
    'Analyze this inspiration artifact for two purposes: taste memory and design-system extraction.',
    'Return JSON with exactly these top-level keys: tasteAnalysis, designSystemExtraction.',
    'Focus facets requested by the caller, but still populate the full structure so a design.md file can be rendered from one pass.',
    'For motion, stay static-first: infer cautiously from the screenshot and user note only, and mark confidence accordingly.',
    'Be concrete, reusable, and avoid generic startup-design language.',
    '',
    `sourceType: ${sourceType}`,
    `sourceUrl: ${sourceUrl || ''}`,
    `userNote: ${userNote || ''}`,
    `legacyTags: ${(tags || []).join(', ')}`,
    `legacyWhyLiked: ${whyLiked || ''}`,
    `legacyStyleCues: ${(styleCues || []).join(', ')}`,
    `focusFacets: ${(facets || []).join(', ')}`,
    '',
    ...buildObservedEvidencePromptLines(observedEvidence),
    'tasteAnalysis schema:',
    '{',
    '  "visualTraits": {',
    '    "typography": string[],',
    '    "colorTreatment": string[],',
    '    "composition": string[],',
    '    "density": string[],',
    '    "spacing": string[],',
    '    "imagery": string[],',
    '    "mood": string[],',
    '    "materials": string[]',
    '  },',
    '  "whyItWorks": string,',
    '  "designSignals": string[],',
    '  "profileContributions": {',
    '    "preferredTypography": string[],',
    '    "preferredPalettes": string[],',
    '    "preferredCompositions": string[],',
    '    "preferredMoods": string[],',
    '    "preferredMaterials": string[],',
    '    "recurringThemes": string[],',
    '    "avoidedPatterns": string[]',
    '  },',
    '  "summary": string',
    '}',
    '',
    'designSystemExtraction schema:',
    '{',
    '  "overview": string,',
    '  "keyCharacteristics": string[],',
    '  "interestingRegions": [{ "id": string, "title": string, "kind": string, "whyItMatters": string, "signals": string[] }],',
    '  "colors": {',
    '    "summary": string,',
    '    "brandTokens": [{ "name": string, "value": string, "role": string }],',
    '    "surfaceTokens": [{ "name": string, "value": string, "role": string }],',
    '    "textTokens": [{ "name": string, "value": string, "role": string }],',
    '    "semanticTokens": [{ "name": string, "value": string, "role": string }],',
    '    "gradientNotes": string[]',
    '  },',
    '  "typography": {',
    '    "summary": string,',
    '    "fontFamilies": [{ "name": string, "role": string, "notes": string }],',
    '    "hierarchy": [{ "name": string, "size": string, "weight": string, "lineHeight": string, "letterSpacing": string, "use": string }],',
    '    "principles": string[]',
    '  },',
    '  "layout": {',
    '    "summary": string,',
    '    "spacingSystem": string[],',
    '    "gridNotes": string[],',
    '    "responsiveStrategy": string[]',
    '  },',
    '  "elevationDepth": {',
    '    "summary": string,',
    '    "levels": [{ "name": string, "treatment": string, "use": string }]',
    '  },',
    '  "shapes": {',
    '    "summary": string,',
    '    "radiusScale": [{ "name": string, "value": string, "use": string }]',
    '  },',
    '  "components": [{ "name": string, "description": string, "properties": string[] }],',
    '  "imageryIllustration": {',
    '    "summary": string,',
    '    "styles": string[],',
    '    "behaviors": string[]',
    '  },',
    '  "motionInteraction": {',
    '    "summary": string,',
    '    "confidence": string,',
    '    "patterns": string[],',
    '    "notes": string[]',
    '  },',
    '  "dos": string[],',
    '  "donts": string[],',
    '  "sourceEvidence": string[]',
    '}',
  ];

  return lines.join('\n');
}

async function buildImageDataUrl(assetPath) {
  const buffer = await fs.readFile(assetPath);
  const extension = path.extname(assetPath).toLowerCase();
  const mimeType = resolveImageMimeType(extension);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function resolveImageMimeType(extension) {
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}

function buildMockAnalysis({
  assetPath,
  sourceType,
  sourceUrl,
  userNote,
  tags,
  whyLiked,
  styleCues,
  facets,
  observedEvidence,
}) {
  const tasteAnalysis = buildMockTasteAnalysis({
    assetPath,
    sourceType,
    sourceUrl,
    userNote,
    tags,
    whyLiked,
    styleCues,
  });

  const enrichedTasteAnalysis = enrichTasteAnalysisWithObservedEvidence(tasteAnalysis, observedEvidence);

  return {
    tasteAnalysis: enrichedTasteAnalysis,
    designSystemExtraction: enrichDesignExtractionWithObservedEvidence(buildFallbackDesignSystemExtraction({
      tasteAnalysis: enrichedTasteAnalysis,
      sourceType,
      sourceUrl,
      userNote,
      tags,
      whyLiked,
      styleCues,
      facets,
      observedEvidence,
    }), observedEvidence),
  };
}

function buildMockTasteAnalysis({
  assetPath,
  sourceType,
  sourceUrl,
  userNote,
  tags,
  whyLiked,
  styleCues,
}) {
  const seedTerms = uniqueStrings([
    ...splitWords(userNote),
    ...splitWords(whyLiked),
    ...(tags || []),
    ...(styleCues || []),
  ]);
  const fallbackTheme = seedTerms[0] || (sourceType === 'url' ? 'editorial clarity' : 'reference detail');
  const fallbackMood = seedTerms[1] || 'considered restraint';
  const assetName = path.basename(assetPath);

  return normalizeTasteAnalysis({
    visualTraits: {
      typography: uniqueStrings([extractMatchingTerm(seedTerms, 'serif') || 'clean type hierarchy']),
      colorTreatment: uniqueStrings([extractMatchingTerm(seedTerms, 'palette') || 'controlled contrast']),
      composition: uniqueStrings([extractMatchingTerm(seedTerms, 'grid') || 'layered composition']),
      density: ['balanced density'],
      spacing: ['intentional whitespace'],
      imagery: sourceType === 'url' ? ['composed screen capture'] : ['curated image reference'],
      mood: uniqueStrings([fallbackMood]),
      materials: ['digital finish'],
    },
    whyItWorks: `This reference feels strong because it combines ${fallbackTheme} with a readable structure and a cohesive visual point of view.`,
    designSignals: uniqueStrings([
      fallbackTheme,
      fallbackMood,
      ...(styleCues || []).slice(0, 3),
      ...(tags || []).slice(0, 3),
      sourceUrl ? 'web-native reference' : 'image-led reference',
      assetName.replace(path.extname(assetName), ''),
    ]).slice(0, 6),
    profileContributions: {
      preferredTypography: uniqueStrings([extractMatchingTerm(seedTerms, 'serif') || 'clear hierarchy']),
      preferredPalettes: uniqueStrings([extractMatchingTerm(seedTerms, 'gradient') || 'controlled contrast']),
      preferredCompositions: uniqueStrings([extractMatchingTerm(seedTerms, 'layout') || 'layered composition']),
      preferredMoods: uniqueStrings([fallbackMood]),
      preferredMaterials: ['digital finish'],
      recurringThemes: uniqueStrings([fallbackTheme, ...(tags || []).slice(0, 2)]),
      avoidedPatterns: [],
    },
    summary: `A ${sourceType} capture emphasizing ${fallbackTheme} and ${fallbackMood}.`,
  });
}

function normalizeCaptureAnalysis(raw, {
  sourceType,
  sourceUrl,
  userNote,
  tags,
  whyLiked,
  styleCues,
  facets,
  observedEvidence,
}) {
  const tasteAnalysis = enrichTasteAnalysisWithObservedEvidence(
    normalizeTasteAnalysis(raw?.tasteAnalysis || raw),
    observedEvidence
  );
  const designSystemExtraction = raw?.designSystemExtraction
    ? normalizeDesignSystemExtraction(raw.designSystemExtraction, { facets })
    : buildFallbackDesignSystemExtraction({
        tasteAnalysis,
        sourceType,
        sourceUrl,
        userNote,
        tags,
        whyLiked,
        styleCues,
        facets,
        observedEvidence,
      });

  return {
    tasteAnalysis,
    designSystemExtraction: enrichDesignExtractionWithObservedEvidence(
      designSystemExtraction,
      observedEvidence
    ),
  };
}

function normalizeTasteAnalysis(raw) {
  return {
    visualTraits: {
      typography: normalizeStringArray(raw?.visualTraits?.typography),
      colorTreatment: normalizeStringArray(raw?.visualTraits?.colorTreatment),
      composition: normalizeStringArray(raw?.visualTraits?.composition),
      density: normalizeStringArray(raw?.visualTraits?.density),
      spacing: normalizeStringArray(raw?.visualTraits?.spacing),
      imagery: normalizeStringArray(raw?.visualTraits?.imagery),
      mood: normalizeStringArray(raw?.visualTraits?.mood),
      materials: normalizeStringArray(raw?.visualTraits?.materials),
    },
    whyItWorks: normalizeText(raw?.whyItWorks) || 'This reference demonstrates a coherent visual point of view.',
    designSignals: normalizeStringArray(raw?.designSignals),
    profileContributions: {
      preferredTypography: normalizeStringArray(raw?.profileContributions?.preferredTypography),
      preferredPalettes: normalizeStringArray(raw?.profileContributions?.preferredPalettes),
      preferredCompositions: normalizeStringArray(raw?.profileContributions?.preferredCompositions),
      preferredMoods: normalizeStringArray(raw?.profileContributions?.preferredMoods),
      preferredMaterials: normalizeStringArray(raw?.profileContributions?.preferredMaterials),
      recurringThemes: normalizeStringArray(raw?.profileContributions?.recurringThemes),
      avoidedPatterns: normalizeStringArray(raw?.profileContributions?.avoidedPatterns),
    },
    summary: normalizeText(raw?.summary) || 'Taste signals extracted from a saved inspiration reference.',
  };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const items = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }
    const trimmed = item.trim();
    if (!trimmed || items.includes(trimmed)) {
      continue;
    }
    items.push(trimmed);
  }
  return items;
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function buildObservedEvidencePromptLines(observedEvidence) {
  if (!observedEvidence || typeof observedEvidence !== 'object') {
    return [];
  }

  const loadedFonts = normalizeStringArray((observedEvidence.loadedFonts || []).map((item) => item.family));
  const headingSamples = summarizeTextSamples(observedEvidence.typography?.headings);
  const bodySamples = summarizeTextSamples(observedEvidence.typography?.body);
  const uiSamples = summarizeTextSamples(observedEvidence.typography?.ui);
  const textColors = summarizeColorEntries(observedEvidence.colors?.textColors);
  const surfaceColors = summarizeColorEntries(observedEvidence.colors?.surfaceColors);
  const accentCandidates = summarizeAccentEntries(observedEvidence.colors?.accentCandidates);
  const gradients = normalizeStringArray(observedEvidence.colors?.gradients).map(shortenObservedGradient);
  const illustrationSummary = summarizeIllustrationEvidence(observedEvidence.illustrations);

  const lines = [
    'Observed site evidence from the live DOM and computed styles. Prefer this evidence over screenshot inference when naming font families, describing color tokens, or describing illustration/media systems.',
    `observedLoadedFonts: ${loadedFonts.join(', ')}`,
    `observedHeadingSamples: ${headingSamples.join(' | ')}`,
    `observedBodySamples: ${bodySamples.join(' | ')}`,
    `observedUiSamples: ${uiSamples.join(' | ')}`,
    `observedTextColors: ${textColors.join(', ')}`,
    `observedSurfaceColors: ${surfaceColors.join(', ')}`,
    `observedAccentCandidates: ${accentCandidates.join(' | ')}`,
    `observedGradients: ${gradients.join(' | ')}`,
    `observedIllustrationSystem: ${illustrationSummary.join(' | ')}`,
    '',
    'If observedLoadedFonts contains named families, use those exact families or explicitly distinguish display/body/ui families. Do not replace them with generic substitutes like Inter unless the observed evidence is absent.',
    'If observedTextColors, observedSurfaceColors, or observedAccentCandidates provide actual values, prefer those for color tokens and summaries.',
    'If observedIllustrationSystem mentions SVG, image, background-image, or named asset patterns, use that to describe the illustration/media system precisely.',
    '',
  ];

  return lines;
}

function enrichTasteAnalysisWithObservedEvidence(tasteAnalysis, observedEvidence) {
  if (!observedEvidence || typeof observedEvidence !== 'object') {
    return tasteAnalysis;
  }

  const enriched = structuredClone(tasteAnalysis);
  const loadedFonts = normalizeStringArray((observedEvidence.loadedFonts || []).map((item) => item.family));
  const headingSamples = normalizeTextSamples(observedEvidence.typography?.headings);
  const bodySamples = normalizeTextSamples(observedEvidence.typography?.body);
  const uiSamples = normalizeTextSamples(observedEvidence.typography?.ui);

  const displayFont = headingSamples[0]?.fontFamily || loadedFonts.find((family) => family.toLowerCase().includes('ivar')) || loadedFonts[0] || null;
  const bodyFont = bodySamples[0]?.fontFamily || loadedFonts.find((family) => family.toLowerCase().includes('abcd')) || loadedFonts[1] || null;
  const uiFont = uiSamples[0]?.fontFamily || loadedFonts.find((family) => family.toLowerCase().includes('silkscreen')) || loadedFonts[2] || bodyFont;

  const observedTypographySignals = uniqueStrings([
    displayFont ? `Display/headline face: ${displayFont}` : null,
    bodyFont ? `Body/interface face: ${bodyFont}` : null,
    uiFont && uiFont !== bodyFont ? `Accent/UI label face: ${uiFont}` : null,
    headingSamples[0]
      ? `Observed heading style ${headingSamples[0].fontSize} / ${headingSamples[0].fontWeight}`
      : null,
    bodySamples[0]
      ? `Observed body style ${bodySamples[0].fontSize} / ${bodySamples[0].fontWeight}`
      : null,
  ]);

  enriched.visualTraits.typography = uniqueStrings([
    ...observedTypographySignals,
    ...enriched.visualTraits.typography,
  ]);

  const accentSignals = normalizeColorEntries(observedEvidence.colors?.accentCandidates)
    .slice(0, 3)
    .map((entry) => `Accent color ${entry.value}`);
  const gradientSignals = normalizeStringArray(observedEvidence.colors?.gradients)
    .slice(0, 2)
    .map((value) => `Gradient treatment ${shortenObservedGradient(value)}`);
  const surfaceSignals = normalizeColorEntries(observedEvidence.colors?.surfaceColors)
    .slice(0, 3)
    .map((entry) => `Surface color ${entry.value}`);

  enriched.visualTraits.colorTreatment = uniqueStrings([
    ...accentSignals,
    ...gradientSignals,
    ...surfaceSignals,
    ...enriched.visualTraits.colorTreatment,
  ]);

  const illustrationSignals = buildIllustrationSignals(observedEvidence.illustrations);
  enriched.visualTraits.imagery = uniqueStrings([
    ...illustrationSignals,
    ...enriched.visualTraits.imagery,
  ]);

  enriched.designSignals = uniqueStrings([
    ...observedTypographySignals,
    ...accentSignals,
    ...illustrationSignals,
    ...enriched.designSignals,
  ]).slice(0, 10);

  enriched.profileContributions.preferredTypography = uniqueStrings([
    displayFont ? `Display ${displayFont}` : null,
    bodyFont ? `Body ${bodyFont}` : null,
    ...enriched.profileContributions.preferredTypography,
  ]);
  enriched.profileContributions.preferredPalettes = uniqueStrings([
    ...accentSignals,
    ...gradientSignals,
    ...enriched.profileContributions.preferredPalettes,
  ]);
  enriched.profileContributions.preferredMaterials = uniqueStrings([
    ...buildIllustrationMaterialSignals(observedEvidence.illustrations),
    ...enriched.profileContributions.preferredMaterials,
  ]);

  return enriched;
}

function enrichDesignExtractionWithObservedEvidence(extraction, observedEvidence) {
  if (!observedEvidence || typeof observedEvidence !== 'object') {
    return extraction;
  }

  const loadedFonts = normalizeStringArray((observedEvidence.loadedFonts || []).map((item) => item.family));
  const headingSamples = normalizeTextSamples(observedEvidence.typography?.headings);
  const bodySamples = normalizeTextSamples(observedEvidence.typography?.body);
  const uiSamples = normalizeTextSamples(observedEvidence.typography?.ui);

  const displayFont = headingSamples[0]?.fontFamily || loadedFonts.find((family) => family.toLowerCase().includes('ivar')) || loadedFonts[0] || null;
  const bodyFont = bodySamples[0]?.fontFamily || loadedFonts.find((family) => family.toLowerCase().includes('abcd')) || loadedFonts[1] || null;
  const accentFont = uiSamples[0]?.fontFamily || loadedFonts.find((family) => family.toLowerCase().includes('silkscreen')) || null;

  if (displayFont || bodyFont || accentFont) {
    extraction.typography.fontFamilies = uniqueFontFamilies([
      displayFont ? {
        name: displayFont,
        role: 'Display and heading voice',
        notes: headingSamples[0]
          ? `Observed in prominent headings at ${headingSamples[0].fontSize} / ${headingSamples[0].fontWeight}.`
          : 'Observed from live page fonts.',
      } : null,
      bodyFont ? {
        name: bodyFont,
        role: 'Body and interface copy',
        notes: bodySamples[0]
          ? `Observed in body text at ${bodySamples[0].fontSize} / ${bodySamples[0].fontWeight}.`
          : 'Observed from live page fonts.',
      } : null,
      accentFont && accentFont !== bodyFont ? {
        name: accentFont,
        role: 'Accent or label moments',
        notes: 'Observed in smaller UI or label treatments.',
      } : null,
      ...extraction.typography.fontFamilies,
    ]);
  }

  extraction.typography.summary = buildTypographySummary({
    displayFont,
    bodyFont,
    accentFont,
    existingSummary: extraction.typography.summary,
  });

  extraction.typography.hierarchy = uniqueHierarchy([
    buildHierarchyToken('Display headline', headingSamples[0], 'Hero and major section headlines'),
    buildHierarchyToken('Body copy', bodySamples[0], 'Body copy and supporting explanation'),
    buildHierarchyToken('UI label or button', uiSamples[0], 'Navigation, buttons, and small interface accents'),
    ...extraction.typography.hierarchy,
  ]);

  const brandTokens = observedColorTokens(observedEvidence.colors?.accentCandidates, 'Brand Accent');
  const surfaceTokens = observedColorTokens(observedEvidence.colors?.surfaceColors, 'Surface');
  const textTokens = observedColorTokens(observedEvidence.colors?.textColors, 'Text');
  const borderTokens = observedColorTokens(observedEvidence.colors?.borderColors, 'Border');

  extraction.colors.brandTokens = uniqueTokens([
    ...brandTokens,
    ...extraction.colors.brandTokens,
  ]);
  extraction.colors.surfaceTokens = uniqueTokens([
    ...surfaceTokens,
    ...borderTokens.filter((token) => token.value && token.value !== token.name),
    ...extraction.colors.surfaceTokens,
  ]);
  extraction.colors.textTokens = uniqueTokens([
    ...textTokens,
    ...extraction.colors.textTokens,
  ]);
  extraction.colors.gradientNotes = uniqueStrings([
    ...normalizeStringArray(observedEvidence.colors?.gradients),
    ...extraction.colors.gradientNotes,
  ]);
  extraction.colors.summary = buildColorSummary({
    accentTokens: extraction.colors.brandTokens,
    surfaceTokens: extraction.colors.surfaceTokens,
    textTokens: extraction.colors.textTokens,
    gradients: extraction.colors.gradientNotes,
    existingSummary: extraction.colors.summary,
  });

  const illustrationSignals = buildIllustrationSignals(observedEvidence.illustrations);
  extraction.imageryIllustration.styles = uniqueStrings([
    ...illustrationSignals,
    ...extraction.imageryIllustration.styles,
  ]);
  extraction.imageryIllustration.summary = buildIllustrationSummary({
    signals: extraction.imageryIllustration.styles,
    existingSummary: extraction.imageryIllustration.summary,
  });

  extraction.sourceEvidence = uniqueStrings([
    ...extraction.sourceEvidence,
    ...loadedFonts.map((family) => `Observed loaded font: ${family}`),
    ...normalizeColorEntries(observedEvidence.colors?.accentCandidates).map((entry) => `Observed accent color: ${entry.value}`),
    ...buildIllustrationEvidenceLines(observedEvidence.illustrations),
  ]);

  return extraction;
}

function splitWords(value) {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(/[,.\n]/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function uniqueStrings(values) {
  const items = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed || items.includes(trimmed)) {
      continue;
    }
    items.push(trimmed);
  }
  return items;
}

function extractMatchingTerm(values, fragment) {
  return values.find((value) => value.toLowerCase().includes(fragment)) || null;
}

function truncate(value, maxLength) {
  if (typeof value !== 'string' || value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
}

function summarizeTextSamples(samples) {
  return normalizeTextSamples(samples)
    .slice(0, 4)
    .map((sample) => `${sample.fontFamily || 'Unknown font'} ${sample.fontSize || ''} ${sample.fontWeight || ''}`.trim());
}

function summarizeColorEntries(entries) {
  return normalizeColorEntries(entries).slice(0, 6).map((entry) => `${entry.value} x${entry.count}`);
}

function summarizeAccentEntries(entries) {
  return normalizeAccentEntries(entries)
    .slice(0, 6)
    .map((entry) => `${entry.value}${entry.label ? ` (${entry.label})` : ''}`);
}

function summarizeIllustrationEvidence(illustrations) {
  if (!illustrations || typeof illustrations !== 'object') {
    return [];
  }

  const summary = [];
  const mediaSummary = illustrations.mediaSummary || {};
  summary.push(`img:${mediaSummary.imgCount || 0}`);
  summary.push(`svg:${mediaSummary.svgCount || 0}`);
  summary.push(`canvas:${mediaSummary.canvasCount || 0}`);
  summary.push(`picture:${mediaSummary.pictureCount || 0}`);
  summary.push(`background-image:${mediaSummary.backgroundImageCount || 0}`);

  const samples = normalizeMediaSamples(illustrations.mediaSamples).slice(0, 4);
  for (const sample of samples) {
    summary.push(`${sample.kind}${sample.alt ? ` ${sample.alt}` : sample.src ? ` ${sample.src}` : ''}`.trim());
  }

  return summary;
}

function normalizeTextSamples(samples) {
  if (!Array.isArray(samples)) {
    return [];
  }
  return samples
    .filter((sample) => sample && typeof sample === 'object')
    .map((sample) => ({
      fontFamily: normalizeText(sample.fontFamily),
      fontSize: normalizeText(sample.fontSize),
      fontWeight: normalizeText(sample.fontWeight),
      lineHeight: normalizeText(sample.lineHeight),
      letterSpacing: normalizeText(sample.letterSpacing),
      textTransform: normalizeText(sample.textTransform),
      color: normalizeText(sample.color),
      text: normalizeText(sample.text),
    }))
    .filter((sample) => sample.fontFamily || sample.text);
}

function normalizeColorEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .filter((entry) => entry && typeof entry === 'object' && normalizeText(entry.value))
    .map((entry) => ({
      value: normalizeText(entry.value),
      count: Number.isFinite(entry.count) ? entry.count : 0,
    }));
}

function normalizeAccentEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .filter((entry) => entry && typeof entry === 'object' && normalizeText(entry.value))
    .map((entry) => ({
      value: normalizeText(entry.value),
      textColor: normalizeText(entry.textColor),
      label: normalizeText(entry.label),
      fontFamily: normalizeText(entry.fontFamily),
    }));
}

function normalizeMediaSamples(samples) {
  if (!Array.isArray(samples)) {
    return [];
  }
  return samples
    .filter((sample) => sample && typeof sample === 'object' && normalizeText(sample.kind))
    .map((sample) => ({
      kind: normalizeText(sample.kind),
      alt: normalizeText(sample.alt),
      src: normalizeText(sample.src),
      width: sample.width,
      height: sample.height,
      area: sample.area,
    }));
}

function buildIllustrationSignals(illustrations) {
  if (!illustrations || typeof illustrations !== 'object') {
    return [];
  }

  const summary = illustrations.mediaSummary || {};
  const signals = [];
  if (summary.svgCount > 0) {
    signals.push('SVG/vector illustration system present');
  }
  if (summary.imgCount > 0) {
    signals.push('Raster image assets or screenshots present');
  }
  if (summary.backgroundImageCount > 0) {
    signals.push('Decorative background image layers present');
  }

  for (const sample of normalizeMediaSamples(illustrations.mediaSamples).slice(0, 4)) {
    const prominence = sample.area && sample.area > 80000 ? 'Prominent' : 'Visible';
    const altLower = (sample.alt || '').toLowerCase();
    const srcLower = (sample.src || '').toLowerCase();
    const looksLikeBackgroundAsset = altLower.includes('background') || altLower.includes('transition') || srcLower.includes('background');

    if (looksLikeBackgroundAsset) {
      continue;
    }

    if (sample.alt) {
      signals.push(`${prominence} ${sample.kind} media: ${sample.alt}`);
    } else if (sample.src) {
      signals.push(`${prominence} ${sample.kind} asset: ${basenameFromSrc(sample.src)}`);
    } else {
      signals.push(`${prominence} ${sample.kind} media element`);
    }
  }

  return uniqueStrings(signals);
}

function buildIllustrationMaterialSignals(illustrations) {
  if (!illustrations || typeof illustrations !== 'object') {
    return [];
  }
  const summary = illustrations.mediaSummary || {};
  const signals = [];
  if (summary.svgCount > 0) {
    signals.push('Vector-led imagery');
  }
  if (summary.imgCount > 0) {
    signals.push('Raster product imagery');
  }
  if (summary.backgroundImageCount > 0) {
    signals.push('Layered background imagery');
  }
  return uniqueStrings(signals);
}

function uniqueFontFamilies(items) {
  const normalized = [];
  const seen = new Set();
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const name = normalizeText(item.name);
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    normalized.push({
      name,
      role: normalizeText(item.role) || 'Primary family',
      notes: normalizeText(item.notes) || '',
    });
  }
  return normalized;
}

function uniqueHierarchy(items) {
  const normalized = [];
  const seen = new Set();
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const name = normalizeText(item.name);
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    normalized.push({
      name,
      size: normalizeText(item.size) || '',
      weight: normalizeText(item.weight) || '',
      lineHeight: normalizeText(item.lineHeight) || '',
      letterSpacing: normalizeText(item.letterSpacing) || '',
      use: normalizeText(item.use) || '',
    });
  }
  return normalized;
}

function buildHierarchyToken(name, sample, use) {
  if (!sample) {
    return null;
  }
  return {
    name,
    size: sample.fontSize || '',
    weight: sample.fontWeight || '',
    lineHeight: sample.lineHeight || '',
    letterSpacing: sample.letterSpacing || '',
    use,
  };
}

function observedColorTokens(entries, prefix) {
  return normalizeColorEntries(entries).slice(0, 6).map((entry, index) => ({
    name: `${prefix} ${index + 1}`,
    value: entry.value,
    role: `Observed ${prefix.toLowerCase()} color`,
  }));
}

function uniqueTokens(items) {
  const normalized = [];
  const seen = new Set();
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const value = normalizeText(item.value);
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push({
      name: normalizeText(item.name) || value,
      value,
      role: normalizeText(item.role) || 'Observed token',
    });
  }
  return normalized;
}

function buildTypographySummary({ displayFont, bodyFont, accentFont, existingSummary }) {
  const parts = [];
  if (displayFont) {
    parts.push(`display typography led by ${displayFont}`);
  }
  if (bodyFont) {
    parts.push(`body/interface text in ${bodyFont}`);
  }
  if (accentFont && accentFont !== bodyFont) {
    parts.push(`small accent moments using ${accentFont}`);
  }
  if (parts.length === 0) {
    return existingSummary;
  }
  return `Typography uses ${parts.join(', ')} rather than a single undifferentiated font system.`;
}

function buildColorSummary({ accentTokens, surfaceTokens, textTokens, gradients, existingSummary }) {
  const accents = accentTokens.slice(0, 3).map((token) => token.value);
  const surfaces = surfaceTokens.slice(0, 2).map((token) => token.value);
  const texts = textTokens.slice(0, 2).map((token) => token.value);
  if (accents.length === 0 && surfaces.length === 0 && texts.length === 0 && gradients.length === 0) {
    return existingSummary;
  }
  const fragments = [];
  if (gradients.length > 0) {
    fragments.push('observed gradient backgrounds');
  }
  if (accents.length > 0) {
    fragments.push(`accent colors like ${accents.join(', ')}`);
  }
  if (surfaces.length > 0) {
    fragments.push(`surface colors like ${surfaces.join(', ')}`);
  }
  if (texts.length > 0) {
    fragments.push(`text colors like ${texts.join(', ')}`);
  }
  return `The color system is grounded in ${fragments.join(', ')} taken from the live page rather than inferred only from the screenshot.`;
}

function buildIllustrationSummary({ signals, existingSummary }) {
  if (!Array.isArray(signals) || signals.length === 0) {
    return existingSummary;
  }
  return `The illustration and media system appears to rely on ${signals.slice(0, 3).join(', ')}.`;
}

function buildIllustrationEvidenceLines(illustrations) {
  return summarizeIllustrationEvidence(illustrations).map((item) => `Observed media evidence: ${item}`);
}

function basenameFromSrc(src) {
  const value = normalizeText(src);
  if (!value) {
    return '';
  }
  const cleaned = value.split('?')[0];
  const parts = cleaned.split('/');
  return parts[parts.length - 1] || cleaned;
}

function shortenObservedGradient(value) {
  const text = normalizeText(value);
  if (!text) {
    return '';
  }
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

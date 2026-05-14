#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';

export const defaultDesignFacets = [
  'colors',
  'typography',
  'layout',
  'components',
  'imagery',
  'motion',
  'dos-donts',
];

export function normalizeDesignFacets(facets) {
  if (!facets) {
    return [...defaultDesignFacets];
  }

  const input = Array.isArray(facets) ? facets : [facets];
  const normalized = [];

  for (const facet of input) {
    if (typeof facet !== 'string') {
      continue;
    }
    const trimmed = facet.trim().toLowerCase();
    if (!trimmed) {
      continue;
    }
    if (!defaultDesignFacets.includes(trimmed)) {
      throw new Error(`Unsupported design facet: ${trimmed}`);
    }
    if (!normalized.includes(trimmed)) {
      normalized.push(trimmed);
    }
  }

  return normalized.length > 0 ? normalized : [...defaultDesignFacets];
}

export function getReferenceDesignPaths({ libraryRoot, recordId }) {
  const designRoot = path.join(libraryRoot, 'design-docs', 'references', recordId);
  return {
    designRoot,
    designSystemJsonPath: path.join(designRoot, 'design-system.json'),
    designMdPath: path.join(designRoot, 'design.md'),
    explainJsonPath: path.join(designRoot, 'explain.json'),
    explainMdPath: path.join(designRoot, 'explain.md'),
  };
}

export function resolveReferenceDesignPaths({ libraryRoot, record }) {
  const root = libraryRoot || record?.resolvedDestination;
  if (!root || !record?.id) {
    return {
      designRoot: record?.designSystemJsonPath ? path.dirname(record.designSystemJsonPath) : null,
      designSystemJsonPath: record?.designSystemJsonPath || null,
      designMdPath: record?.designMdPath || null,
      explainJsonPath: record?.designExplainJsonPath || null,
      explainMdPath: record?.designExplainMdPath || null,
    };
  }

  const fallback = getReferenceDesignPaths({
    libraryRoot: root,
    recordId: record.id,
  });

  return {
    designRoot: fallback.designRoot,
    designSystemJsonPath: record?.designSystemJsonPath || fallback.designSystemJsonPath,
    designMdPath: record?.designMdPath || fallback.designMdPath,
    explainJsonPath: record?.designExplainJsonPath || fallback.explainJsonPath,
    explainMdPath: record?.designExplainMdPath || fallback.explainMdPath,
  };
}

export function getLibraryDesignPaths({ libraryRoot }) {
  const designRoot = path.join(libraryRoot, 'design-docs', 'library');
  return {
    designRoot,
    designSystemJsonPath: path.join(designRoot, 'design-system.json'),
    designMdPath: path.join(designRoot, 'design.md'),
  };
}

function buildEmptyIngredientLayer() {
  return {
    visual: {
      typography: [],
      palette: [],
      layoutRhythm: [],
      imageryMode: [],
      materiality: [],
      realism: [],
      mood: [],
      antiPatterns: [],
    },
    pageMaking: {
      heroPosture: [],
      proofStyle: [],
      ctaTone: [],
      sectionPacing: [],
      installVisibility: [],
      artifactDisplayStrategy: [],
    },
  };
}

function normalizeIngredientItem(value, family) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const label = normalizeText(value.label);
  if (!label) {
    return null;
  }

  const normalizedFamily = family || normalizeText(value.family) || 'ingredient';
  const id = normalizeText(value.id) || `${slugify(normalizedFamily)}-${slugify(label)}`;
  const sourcePointers = Array.isArray(value.sourcePointers)
    ? value.sourcePointers
        .filter((item) => item && typeof item === 'object' && normalizeText(item.kind) && normalizeText(item.value))
        .map((item) => ({
          kind: normalizeText(item.kind),
          value: normalizeText(item.value),
          note: normalizeText(item.note),
        }))
    : [];

  return {
    id,
    family: normalizedFamily,
    label,
    detail: normalizeText(value.detail),
    signals: normalizeStringArray(value.signals),
    sourcePointers,
    sourceRecordIds: normalizeStringArray(value.sourceRecordIds),
    count: Number.isFinite(value.count) ? value.count : undefined,
    role: normalizeText(value.role),
  };
}

function normalizeIngredientItems(value, family) {
  if (!Array.isArray(value)) {
    return [];
  }

  const items = [];
  const seen = new Set();
  for (const item of value) {
    const normalized = normalizeIngredientItem(item, family);
    if (!normalized || seen.has(normalized.id)) {
      continue;
    }
    seen.add(normalized.id);
    items.push(normalized);
  }
  return items;
}

function normalizeIngredientLayer(value) {
  const empty = buildEmptyIngredientLayer();
  if (!value || typeof value !== 'object') {
    return empty;
  }

  return {
    visual: {
      typography: normalizeIngredientItems(value.visual?.typography, 'visual.typography'),
      palette: normalizeIngredientItems(value.visual?.palette, 'visual.palette'),
      layoutRhythm: normalizeIngredientItems(value.visual?.layoutRhythm, 'visual.layoutRhythm'),
      imageryMode: normalizeIngredientItems(value.visual?.imageryMode, 'visual.imageryMode'),
      materiality: normalizeIngredientItems(value.visual?.materiality, 'visual.materiality'),
      realism: normalizeIngredientItems(value.visual?.realism, 'visual.realism'),
      mood: normalizeIngredientItems(value.visual?.mood, 'visual.mood'),
      antiPatterns: normalizeIngredientItems(value.visual?.antiPatterns, 'visual.antiPatterns'),
    },
    pageMaking: {
      heroPosture: normalizeIngredientItems(value.pageMaking?.heroPosture, 'pageMaking.heroPosture'),
      proofStyle: normalizeIngredientItems(value.pageMaking?.proofStyle, 'pageMaking.proofStyle'),
      ctaTone: normalizeIngredientItems(value.pageMaking?.ctaTone, 'pageMaking.ctaTone'),
      sectionPacing: normalizeIngredientItems(value.pageMaking?.sectionPacing, 'pageMaking.sectionPacing'),
      installVisibility: normalizeIngredientItems(value.pageMaking?.installVisibility, 'pageMaking.installVisibility'),
      artifactDisplayStrategy: normalizeIngredientItems(value.pageMaking?.artifactDisplayStrategy, 'pageMaking.artifactDisplayStrategy'),
    },
  };
}

function buildIngredientItem({
  family,
  label,
  detail,
  signals,
  sourcePointers,
  sourceRecordIds,
  count,
  role,
}) {
  return normalizeIngredientItem({
    id: `${slugify(family)}-${slugify(label)}`,
    family,
    label,
    detail,
    signals,
    sourcePointers,
    sourceRecordIds,
    count,
    role,
  }, family);
}

function buildSourcePointers({ record, extraction, signals, fallbackKind = 'evidence' }) {
  const pointers = [];
  for (const region of extraction.interestingRegions || []) {
    pointers.push({
      kind: 'region',
      value: region.title,
      note: region.whyItMatters,
    });
  }
  for (const signal of normalizeStringArray(signals).slice(0, 4)) {
    pointers.push({
      kind: fallbackKind,
      value: signal,
      note: null,
    });
  }
  if (record?.userNote) {
    pointers.push({
      kind: 'note',
      value: record.userNote,
      note: 'user note',
    });
  }
  if (record?.sourceUrl) {
    pointers.push({
      kind: 'reference',
      value: record.sourceUrl,
      note: 'captured source',
    });
  }

  return dedupePointers(pointers).slice(0, 8);
}

function dedupePointers(pointers) {
  const deduped = [];
  const seen = new Set();
  for (const pointer of pointers) {
    if (!pointer?.kind || !pointer?.value) {
      continue;
    }
    const key = `${pointer.kind}:${pointer.value}:${pointer.note || ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(pointer);
  }
  return deduped;
}

export function buildFallbackDesignSystemExtraction({
  tasteAnalysis,
  sourceType,
  sourceUrl,
  userNote,
  tags,
  whyLiked,
  styleCues,
  facets,
}) {
  const normalizedFacets = normalizeDesignFacets(facets);
  const taste = tasteAnalysis || {};
  const visualTraits = taste.visualTraits || {};
  const signalSeed = uniqueStrings([
    ...normalizeStringArray(taste.designSignals),
    ...normalizeStringArray(tags),
    ...normalizeStringArray(styleCues),
    ...splitHints(userNote),
    ...splitHints(whyLiked),
  ]);

  const themeLead = signalSeed[0] || visualTraits.composition?.[0] || 'clarity-first presentation';
  const moodLead = visualTraits.mood?.[0] || signalSeed[1] || 'measured confidence';
  const paletteLead = visualTraits.colorTreatment?.[0] || 'controlled contrast';
  const typeLead = visualTraits.typography?.[0] || 'clear hierarchy';
  const sourceDescriptor = sourceType === 'url' ? 'web reference' : 'image reference';

  return normalizeDesignSystemExtraction({
    overview: `This ${sourceDescriptor} leans on ${themeLead}, ${paletteLead}, and ${typeLead} to create a ${moodLead} product-design direction.`,
    keyCharacteristics: uniqueStrings([
      themeLead,
      paletteLead,
      typeLead,
      ...(taste.designSignals || []).slice(0, 4),
    ]).slice(0, 6),
    interestingRegions: sourceType === 'url'
      ? [
          {
            id: 'hero-band',
            title: 'Hero band',
            kind: 'hero',
            whyItMatters: 'This is the clearest concentration of brand voice, typography scale, and CTA posture.',
            signals: uniqueStrings([
              visualTraits.typography?.[0] || 'headline hierarchy',
              visualTraits.colorTreatment?.[0] || 'palette treatment',
              visualTraits.composition?.[0] || 'hero layout',
            ]),
          },
          {
            id: 'content-system',
            title: 'Supporting content system',
            kind: 'layout',
            whyItMatters: 'This area usually shows how the design system repeats across cards, sections, and proof blocks.',
            signals: uniqueStrings([
              visualTraits.spacing?.[0] || 'section spacing',
              visualTraits.density?.[0] || 'content density',
              visualTraits.imagery?.[0] || 'imagery style',
            ]),
          },
        ]
      : [
          {
            id: 'dominant-composition',
            title: 'Dominant composition area',
            kind: 'composition',
            whyItMatters: 'This zone holds the most obvious layout and framing decisions in the saved reference.',
            signals: uniqueStrings([
              visualTraits.composition?.[0] || 'composition rhythm',
              visualTraits.spacing?.[0] || 'spacing control',
              visualTraits.imagery?.[0] || 'image treatment',
            ]),
          },
        ],
    colors: {
      summary: `The palette reads as ${paletteLead} with accents used to reinforce structure rather than overwhelm it.`,
      brandTokens: buildFallbackTokens(visualTraits.colorTreatment, 'Brand Accent'),
      surfaceTokens: buildFallbackTokens(['light canvas', 'soft contrast surfaces'], 'Surface'),
      textTokens: buildFallbackTokens(['high-contrast body copy', 'supporting muted text'], 'Text'),
      semanticTokens: [],
      gradientNotes: uniqueStrings([
        ...normalizeStringArray(styleCues).filter((value) => value.toLowerCase().includes('gradient')),
        ...normalizeStringArray(visualTraits.colorTreatment).filter((value) => value.toLowerCase().includes('gradient')),
      ]),
    },
    typography: {
      summary: `Typography emphasizes ${typeLead} and keeps readability ahead of ornament.`,
      fontFamilies: [
        {
          name: 'Observed primary type system',
          role: 'Headlines and interface hierarchy',
          notes: typeLead,
        },
      ],
      hierarchy: [
        {
          name: 'Display headline',
          size: 'Large, dominant scale',
          weight: 'Medium to bold',
          lineHeight: 'Tight to balanced',
          letterSpacing: 'Slightly tightened',
          use: 'Hero or section-level narrative voice',
        },
        {
          name: 'Body copy',
          size: 'Comfortable reading size',
          weight: 'Regular',
          lineHeight: 'Readable, calm rhythm',
          letterSpacing: 'Neutral',
          use: 'Explanatory product copy and supporting detail',
        },
      ],
      principles: uniqueStrings([
        typeLead,
        'Readable hierarchy over novelty',
        'Interface voice stays consistent across sections',
      ]),
    },
    layout: {
      summary: `Layout decisions reinforce ${themeLead} through spacing, section rhythm, and predictable information flow.`,
      spacingSystem: uniqueStrings([
        visualTraits.spacing?.[0] || 'Generous whitespace',
        visualTraits.density?.[0] || 'Balanced content density',
      ]),
      gridNotes: uniqueStrings([
        visualTraits.composition?.[0] || 'Modular section stacking',
        'Clear content grouping',
      ]),
      responsiveStrategy: [
        'Primary story should preserve hierarchy when stacked.',
        'Dense supporting content should collapse into simpler modular groupings on small screens.',
      ],
    },
    elevationDepth: {
      summary: 'Depth is mostly created with surface contrast, not theatrical shadow.',
      levels: [
        {
          name: 'Base surface',
          treatment: 'Flat or softly differentiated surface',
          use: 'Page foundation and long content bands',
        },
        {
          name: 'Component surface',
          treatment: 'Hairline border or slight contrast lift',
          use: 'Cards, grouped content, or proof modules',
        },
      ],
    },
    shapes: {
      summary: 'Shape language stays restrained so the system feels intentional rather than decorative.',
      radiusScale: [
        {
          name: 'Primary card radius',
          value: 'Small to medium rounding',
          use: 'Cards, buttons, and grouped interface chrome',
        },
      ],
    },
    components: [
      {
        name: 'Hero composition',
        description: 'Primary story block that carries the clearest expression of hierarchy and conversion intent.',
        properties: uniqueStrings([
          visualTraits.composition?.[0] || 'Strong focal hierarchy',
          visualTraits.typography?.[0] || 'Large-scale headline system',
          visualTraits.colorTreatment?.[0] || 'Controlled accent use',
        ]),
      },
      {
        name: 'Support card system',
        description: 'Repeating section or proof blocks used to make the broader system feel coherent.',
        properties: uniqueStrings([
          visualTraits.spacing?.[0] || 'Consistent internal spacing',
          visualTraits.density?.[0] || 'Measured information density',
          visualTraits.imagery?.[0] || 'Consistent media treatment',
        ]),
      },
    ],
    imageryIllustration: {
      summary: `Imagery treatment feels ${visualTraits.imagery?.[0] || 'curated and system-aware'} rather than incidental.`,
      styles: normalizeStringArray(visualTraits.imagery),
      behaviors: [
        'Imagery supports the interface story instead of competing with it.',
        'Visual assets should reinforce the same tonal register as the typography and layout.',
      ],
    },
    motionInteraction: {
      summary: 'Motion cues are inferred from the static capture and any user note rather than directly observed.',
      confidence: 'static-inferred',
      patterns: normalizeStringArray(styleCues).filter((value) =>
        value.toLowerCase().includes('motion') || value.toLowerCase().includes('animation')
      ),
      notes: uniqueStrings([
        'Any motion assessment here is low-confidence unless explicitly mentioned by the user.',
        sourceType === 'url'
          ? 'Assume motion, if present, should reinforce hierarchy or transitions rather than become decorative.'
          : 'No live-site interaction was inspected for this reference.',
      ]),
    },
    dos: [
      'Preserve the core hierarchy and spacing logic when adapting this reference.',
      'Keep visual accents purposeful and tied to structure or emphasis.',
      'Use imagery and typography to reinforce the same tone.',
    ],
    donts: [
      'Do not add decorative clutter that weakens the original clarity.',
      'Do not flatten the hierarchy into uniform text or generic card treatment.',
      'Do not overstate motion or interaction claims from a static capture.',
    ],
    sourceEvidence: uniqueStrings([
      sourceUrl || null,
      userNote || null,
      whyLiked || null,
      ...normalizeStringArray(tags),
      ...normalizeStringArray(styleCues),
      taste.summary || null,
    ]),
  }, { facets: normalizedFacets });
}

export function normalizeDesignSystemExtraction(raw, { facets } = {}) {
  const normalizedFacets = normalizeDesignFacets(facets);

  return {
    generatedAt: new Date().toISOString(),
    facets: normalizedFacets,
    overview: normalizeText(raw?.overview) || 'A structured design-system extraction is not available yet for this reference.',
    keyCharacteristics: normalizeStringArray(raw?.keyCharacteristics),
    interestingRegions: normalizeInterestingRegions(raw?.interestingRegions),
    colors: normalizeColorSection(raw?.colors),
    typography: normalizeTypographySection(raw?.typography),
    layout: normalizeLayoutSection(raw?.layout),
    elevationDepth: normalizeElevationSection(raw?.elevationDepth),
    shapes: normalizeShapesSection(raw?.shapes),
    components: normalizeComponents(raw?.components),
    imageryIllustration: normalizeImagerySection(raw?.imageryIllustration),
    motionInteraction: normalizeMotionSection(raw?.motionInteraction),
    dos: normalizeStringArray(raw?.dos),
    donts: normalizeStringArray(raw?.donts),
    sourceEvidence: normalizeStringArray(raw?.sourceEvidence),
    ingredients: normalizeIngredientLayer(raw?.ingredients),
  };
}

export function hydrateReferenceDesignExtraction({ record, extraction }) {
  const normalized = normalizeDesignSystemExtraction(extraction, {
    facets: extraction?.facets,
  });
  const derivedIngredients = hasAnyIngredientItems(normalized.ingredients)
    ? normalized.ingredients
    : deriveReferenceIngredientLayer({
        record,
        extraction: normalized,
      });

  return {
    ...normalized,
    ingredients: derivedIngredients,
  };
}

function deriveReferenceIngredientLayer({ record, extraction }) {
  const materials = normalizeStringArray([
    ...(record?.tasteAnalysis?.visualTraits?.materials || []),
    ...(record?.tasteAnalysis?.profileContributions?.preferredMaterials || []),
  ]);
  const moods = normalizeStringArray([
    ...(record?.tasteAnalysis?.visualTraits?.mood || []),
    ...(record?.tasteAnalysis?.profileContributions?.preferredMoods || []),
    ...(extraction.keyCharacteristics || []),
  ]);
  const layoutSignals = normalizeStringArray([
    ...(extraction.layout.spacingSystem || []),
    ...(extraction.layout.gridNotes || []),
    ...(record?.tasteAnalysis?.visualTraits?.composition || []),
  ]);
  const paletteSignals = normalizeStringArray([
    ...(extraction.colors.gradientNotes || []),
    ...(record?.tasteAnalysis?.visualTraits?.colorTreatment || []),
  ]);
  const imagerySignals = normalizeStringArray([
    ...(extraction.imageryIllustration.styles || []),
    ...(extraction.imageryIllustration.behaviors || []),
    ...(record?.tasteAnalysis?.visualTraits?.imagery || []),
  ]);
  const typographySignals = normalizeStringArray([
    ...extraction.typography.principles,
    ...(record?.tasteAnalysis?.visualTraits?.typography || []),
  ]);
  const antiPatternSignals = normalizeStringArray([
    ...extraction.donts,
    ...(record?.tasteAnalysis?.profileContributions?.avoidedPatterns || []),
  ]);
  const realismSignals = buildRealismSignals({
    record,
    extraction,
    materials,
    imagerySignals,
  });

  return {
    visual: {
      typography: [
        buildIngredientItem({
          family: 'visual.typography',
          label: extraction.typography.fontFamilies[0]?.name
            ? `${extraction.typography.fontFamilies[0].name} hierarchy`
            : 'Readable hierarchy',
          detail: extraction.typography.summary,
          signals: typographySignals.slice(0, 6),
          sourcePointers: buildSourcePointers({ record, extraction, signals: typographySignals }),
          sourceRecordIds: record?.id ? [record.id] : [],
        }),
      ].filter(Boolean),
      palette: [
        buildIngredientItem({
          family: 'visual.palette',
          label: extraction.colors.brandTokens[0]?.name
            ? `${extraction.colors.brandTokens[0].name} contrast system`
            : 'Controlled palette contrast',
          detail: extraction.colors.summary,
          signals: [
            ...paletteSignals.slice(0, 4),
            ...extraction.colors.brandTokens.slice(0, 3).map((token) => `${token.name}: ${token.role}`),
          ],
          sourcePointers: buildSourcePointers({ record, extraction, signals: paletteSignals }),
          sourceRecordIds: record?.id ? [record.id] : [],
        }),
      ].filter(Boolean),
      layoutRhythm: [
        buildIngredientItem({
          family: 'visual.layoutRhythm',
          label: record?.sourceType === 'local-image' ? 'Tactile grid rhythm' : 'Modular section rhythm',
          detail: extraction.layout.summary,
          signals: layoutSignals.slice(0, 6),
          sourcePointers: buildSourcePointers({ record, extraction, signals: layoutSignals }),
          sourceRecordIds: record?.id ? [record.id] : [],
        }),
      ].filter(Boolean),
      imageryMode: [
        buildIngredientItem({
          family: 'visual.imageryMode',
          label: imagerySignals[0] || 'System-aware imagery',
          detail: extraction.imageryIllustration.summary,
          signals: imagerySignals.slice(0, 6),
          sourcePointers: buildSourcePointers({ record, extraction, signals: imagerySignals }),
          sourceRecordIds: record?.id ? [record.id] : [],
        }),
      ].filter(Boolean),
      materiality: [
        buildIngredientItem({
          family: 'visual.materiality',
          label: buildMaterialityLabel(materials),
          detail: materials[0] || extraction.imageryIllustration.summary,
          signals: materials.slice(0, 6),
          sourcePointers: buildSourcePointers({ record, extraction, signals: materials }),
          sourceRecordIds: record?.id ? [record.id] : [],
        }),
      ].filter(Boolean),
      realism: [
        buildIngredientItem({
          family: 'visual.realism',
          label: realismSignals.label,
          detail: realismSignals.detail,
          signals: realismSignals.signals,
          sourcePointers: buildSourcePointers({ record, extraction, signals: realismSignals.signals }),
          sourceRecordIds: record?.id ? [record.id] : [],
        }),
      ].filter(Boolean),
      mood: [
        buildIngredientItem({
          family: 'visual.mood',
          label: moods[0] || 'Credible tone',
          detail: extraction.overview,
          signals: moods.slice(0, 6),
          sourcePointers: buildSourcePointers({ record, extraction, signals: moods }),
          sourceRecordIds: record?.id ? [record.id] : [],
        }),
      ].filter(Boolean),
      antiPatterns: antiPatternSignals.slice(0, 6).map((signal) =>
        buildIngredientItem({
          family: 'visual.antiPatterns',
          label: signal,
          detail: 'Avoid weakening the core taste signal with this pattern.',
          signals: [signal],
          sourcePointers: buildSourcePointers({ record, extraction, signals: [signal] }),
          sourceRecordIds: record?.id ? [record.id] : [],
          role: 'suppressed',
        })
      ).filter(Boolean),
    },
    pageMaking: {
      heroPosture: [
        buildIngredientItem({
          family: 'pageMaking.heroPosture',
          label: buildHeroPostureLabel({ record, extraction }),
          detail: 'The first impression should concentrate the strongest typography, imagery, and palette signal.',
          signals: uniqueStrings([
            extraction.interestingRegions[0]?.title || null,
            extraction.typography.hierarchy[0]?.use || null,
            extraction.colors.gradientNotes[0] || null,
          ]),
          sourcePointers: buildSourcePointers({ record, extraction, signals: [extraction.interestingRegions[0]?.title] }),
          sourceRecordIds: record?.id ? [record.id] : [],
        }),
      ].filter(Boolean),
      proofStyle: [
        buildIngredientItem({
          family: 'pageMaking.proofStyle',
          label: buildProofStyleLabel({ record, extraction }),
          detail: 'Proof should feel traceable to a real artifact rather than a decorative filler panel.',
          signals: uniqueStrings([
            extraction.components[0]?.name || null,
            extraction.imageryIllustration.styles[0] || null,
            record?.sourceType === 'local-image' ? 'Physical artifact display' : 'Product screenshot evidence',
          ]),
          sourcePointers: buildSourcePointers({ record, extraction, signals: extraction.components.map((component) => component.name) }),
          sourceRecordIds: record?.id ? [record.id] : [],
        }),
      ].filter(Boolean),
      ctaTone: [
        buildIngredientItem({
          family: 'pageMaking.ctaTone',
          label: buildCtaToneLabel(extraction, record),
          detail: 'Action language should match the confidence and contrast level of the underlying visual system.',
          signals: uniqueStrings([
            extraction.colors.brandTokens[0]?.role || null,
            extraction.typography.principles[0] || null,
            extraction.dos[0] || null,
          ]),
          sourcePointers: buildSourcePointers({ record, extraction, signals: extraction.dos }),
          sourceRecordIds: record?.id ? [record.id] : [],
        }),
      ].filter(Boolean),
      sectionPacing: [
        buildIngredientItem({
          family: 'pageMaking.sectionPacing',
          label: record?.sourceType === 'local-image' ? 'Clustered physical pacing' : 'Alternating proof cadence',
          detail: extraction.layout.summary,
          signals: uniqueStrings([
            ...extraction.layout.spacingSystem.slice(0, 3),
            ...extraction.layout.responsiveStrategy.slice(0, 2),
          ]),
          sourcePointers: buildSourcePointers({ record, extraction, signals: extraction.layout.spacingSystem }),
          sourceRecordIds: record?.id ? [record.id] : [],
        }),
      ].filter(Boolean),
      installVisibility: [
        buildIngredientItem({
          family: 'pageMaking.installVisibility',
          label: record?.sourceType === 'url' ? 'Visible action anchor' : 'Earned action reveal',
          detail: record?.sourceType === 'url'
            ? 'Primary actions should remain easy to find without overwhelming the page story.'
            : 'Conversion should emerge after the artifact display has established trust and realism.',
          signals: uniqueStrings([
            extraction.colors.brandTokens[0]?.value || null,
            extraction.layout.spacingSystem[0] || null,
            extraction.typography.hierarchy[0]?.use || null,
          ]),
          sourcePointers: buildSourcePointers({ record, extraction, signals: extraction.colors.gradientNotes }),
          sourceRecordIds: record?.id ? [record.id] : [],
        }),
      ].filter(Boolean),
      artifactDisplayStrategy: [
        buildIngredientItem({
          family: 'pageMaking.artifactDisplayStrategy',
          label: record?.sourceType === 'local-image' ? 'Pinned artifact wall' : 'Structured proof modules',
          detail: record?.sourceType === 'local-image'
            ? 'Artifacts should keep their tactile edges, mixed materials, and slight imperfections.'
            : 'Artifacts should look like intentional proof blocks with clear hierarchy and reusable layout logic.',
          signals: uniqueStrings([
            ...(extraction.interestingRegions || []).map((region) => region.title),
            ...imagerySignals.slice(0, 2),
            ...materials.slice(0, 2),
          ]),
          sourcePointers: buildSourcePointers({ record, extraction, signals: (extraction.interestingRegions || []).map((region) => region.title) }),
          sourceRecordIds: record?.id ? [record.id] : [],
        }),
      ].filter(Boolean),
    },
  };
}

function hasAnyIngredientItems(layer) {
  return flattenIngredientLayer(layer).length > 0;
}

export async function writeReferenceDesignArtifacts({
  libraryRoot,
  record,
  extraction,
}) {
  const paths = getReferenceDesignPaths({
    libraryRoot,
    recordId: record.id,
  });

  const hydratedExtraction = hydrateReferenceDesignExtraction({
    record,
    extraction,
  });
  const explainArtifact = buildReferenceExplainArtifact({
    record,
    extraction: hydratedExtraction,
  });

  await fs.mkdir(paths.designRoot, { recursive: true });
  await fs.writeFile(
    paths.designSystemJsonPath,
    `${JSON.stringify(hydratedExtraction, null, 2)}\n`,
    'utf8'
  );
  await fs.writeFile(
    paths.designMdPath,
    `${renderReferenceDesignMarkdown({ record, extraction: hydratedExtraction })}\n`,
    'utf8'
  );
  await fs.writeFile(
    paths.explainJsonPath,
    `${JSON.stringify(explainArtifact, null, 2)}\n`,
    'utf8'
  );
  await fs.writeFile(
    paths.explainMdPath,
    `${renderReferenceExplainMarkdown(explainArtifact)}\n`,
    'utf8'
  );

  return {
    ...paths,
    extraction: hydratedExtraction,
    explainArtifact,
  };
}

export async function readReferenceDesignExtraction(record) {
  if (!record?.designSystemJsonPath) {
    return null;
  }

  let raw;
  try {
    raw = await fs.readFile(record.designSystemJsonPath, 'utf8');
  } catch {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function loadCompleteDesignReferences({ records, libraryRoot }) {
  const references = [];

  for (const record of Array.isArray(records) ? records : []) {
    if (!record?.id) {
      continue;
    }

    const paths = resolveReferenceDesignPaths({
      libraryRoot,
      record,
    });

    if (!paths.designSystemJsonPath) {
      continue;
    }

    const shouldAttempt =
      record.designExtractionStatus === 'complete' ||
      await fileExists(paths.designSystemJsonPath);

    if (!shouldAttempt) {
      continue;
    }

    const hydratedRecord = {
      ...record,
      designSystemJsonPath: paths.designSystemJsonPath,
      designMdPath: record.designMdPath || paths.designMdPath,
    };
    const extraction = await readReferenceDesignExtraction(hydratedRecord);

    if (!extraction) {
      continue;
    }

    references.push({
      record: hydratedRecord,
      extraction: hydrateReferenceDesignExtraction({
        record: hydratedRecord,
        extraction,
      }),
    });
  }

  return references;
}

export async function synthesizeLibraryDesignSystem({
  records,
  tasteSummary,
  libraryRoot,
}) {
  const extractions = await loadCompleteDesignReferences({
    records,
    libraryRoot,
  });

  const stablePatterns = topStrings(collectStablePatterns(extractions, tasteSummary));
  const antiPatterns = uniqueStrings([
    ...topStrings(collectAntiPatterns(extractions)),
    ...normalizeStringArray(tasteSummary?.antiPatterns),
  ]).slice(0, 10);
  const tensions = uniqueStrings([
    ...normalizeStringArray(tasteSummary?.tensions),
    ...inferDesignTensions(extractions),
  ]).slice(0, 6);
  const sourceRecordIds = extractions.map(({ record }) => record.id);
  const ingredientLayer = buildAggregatedIngredientLayer(extractions);

  return {
    generatedAt: new Date().toISOString(),
    sourceRecordIds,
    sourceCount: extractions.length,
    overview: buildLibraryOverview({
      sourceCount: extractions.length,
      stablePatterns,
      tensions,
    }),
    ingredients: ingredientLayer,
    stablePatterns,
    antiPatterns,
    tensions,
    branchDirections: normalizeBranchDirections(tasteSummary?.branchDirections),
    colors: {
      summary: summarizeSection(
        extractions.map(({ extraction }) => extraction.colors?.summary),
        'The color system trends toward controlled contrast and purposeful accent usage.'
      ),
      recurringTokens: topStrings(collectNamedValues(extractions, 'colors')),
      recurringNotes: topStrings(collectStringSection(extractions, (item) => item.extraction.colors?.gradientNotes)),
    },
    typography: {
      summary: summarizeSection(
        extractions.map(({ extraction }) => extraction.typography?.summary),
        'Typography patterns emphasize hierarchy, readability, and a clear tonal split between display and utility.'
      ),
      recurringPatterns: topStrings(collectStringSection(extractions, (item) => item.extraction.typography?.principles)),
    },
    layout: {
      summary: summarizeSection(
        extractions.map(({ extraction }) => extraction.layout?.summary),
        'Layout patterns emphasize whitespace, modular rhythm, and predictable information flow.'
      ),
      recurringPatterns: topStrings(collectStringSection(extractions, (item) => [
        ...(item.extraction.layout?.spacingSystem || []),
        ...(item.extraction.layout?.gridNotes || []),
        ...(item.extraction.layout?.responsiveStrategy || []),
      ])),
    },
    components: {
      summary: `Recurring component patterns center on ${topStrings(collectComponentNames(extractions)).slice(0, 3).join(', ') || 'structured content blocks'}.`,
      recurringPatterns: topStrings(collectComponentProperties(extractions)),
    },
    imageryIllustration: {
      summary: summarizeSection(
        extractions.map(({ extraction }) => extraction.imageryIllustration?.summary),
        'Imagery tends to support the interface story rather than overpower it.'
      ),
      recurringPatterns: topStrings(collectStringSection(extractions, (item) => [
        ...(item.extraction.imageryIllustration?.styles || []),
        ...(item.extraction.imageryIllustration?.behaviors || []),
      ])),
    },
    motionInteraction: {
      summary: summarizeSection(
        extractions.map(({ extraction }) => extraction.motionInteraction?.summary),
        'Motion guidance remains mostly static-inferred in this version of the system.'
      ),
      confidence: extractions.every(({ extraction }) => extraction.motionInteraction?.confidence === 'static-inferred')
        ? 'static-inferred'
        : 'mixed',
      recurringPatterns: topStrings(collectStringSection(extractions, (item) => [
        ...(item.extraction.motionInteraction?.patterns || []),
        ...(item.extraction.motionInteraction?.notes || []),
      ])),
    },
    dos: topStrings(collectStringSection(extractions, (item) => item.extraction.dos)).slice(0, 10),
    donts: topStrings(collectStringSection(extractions, (item) => item.extraction.donts)).slice(0, 10),
    sourceEvidence: topStrings(collectStringSection(extractions, (item) => item.extraction.sourceEvidence)).slice(0, 12),
  };
}

export async function writeLibraryDesignArtifacts({
  libraryRoot,
  synthesis,
}) {
  const paths = getLibraryDesignPaths({ libraryRoot });
  await fs.mkdir(paths.designRoot, { recursive: true });
  await fs.writeFile(
    paths.designSystemJsonPath,
    `${JSON.stringify(synthesis, null, 2)}\n`,
    'utf8'
  );
  await fs.writeFile(
    paths.designMdPath,
    `${renderLibraryDesignMarkdown(synthesis)}\n`,
    'utf8'
  );
  return paths;
}

export function renderReferenceDesignMarkdown({ record, extraction }) {
  const lines = [
    '# Design System Extraction',
    '',
    '## Overview',
    '',
    extraction.overview,
    '',
    '## Key Characteristics',
    '',
    ...renderBulletList(extraction.keyCharacteristics),
    '',
    '## Interesting Regions',
    '',
    ...renderInterestingRegions(extraction.interestingRegions),
    '',
    '## Colors',
    '',
    extraction.colors.summary,
    '',
    ...renderTokenSection('Brand & Accent', extraction.colors.brandTokens),
    ...renderTokenSection('Surface', extraction.colors.surfaceTokens),
    ...renderTokenSection('Text', extraction.colors.textTokens),
    ...renderTokenSection('Semantic', extraction.colors.semanticTokens),
    ...renderSubBulletList('Gradient Notes', extraction.colors.gradientNotes),
    '',
    '## Typography',
    '',
    extraction.typography.summary,
    '',
    ...renderFontFamilies(extraction.typography.fontFamilies),
    ...renderHierarchyTable(extraction.typography.hierarchy),
    ...renderSubBulletList('Principles', extraction.typography.principles),
    '',
    '## Layout',
    '',
    extraction.layout.summary,
    '',
    ...renderSubBulletList('Spacing System', extraction.layout.spacingSystem),
    ...renderSubBulletList('Grid Notes', extraction.layout.gridNotes),
    ...renderSubBulletList('Responsive Strategy', extraction.layout.responsiveStrategy),
    '',
    '## Elevation & Depth',
    '',
    extraction.elevationDepth.summary,
    '',
    ...renderLevelTable(extraction.elevationDepth.levels),
    '',
    '## Shapes',
    '',
    extraction.shapes.summary,
    '',
    ...renderRadiusTable(extraction.shapes.radiusScale),
    '',
    '## Components',
    '',
    ...renderComponents(extraction.components),
    '',
    '## Imagery & Illustration',
    '',
    extraction.imageryIllustration.summary,
    '',
    ...renderSubBulletList('Styles', extraction.imageryIllustration.styles),
    ...renderSubBulletList('Behaviors', extraction.imageryIllustration.behaviors),
    '',
    '## Motion & Interaction',
    '',
    extraction.motionInteraction.summary,
    '',
    `Confidence: ${extraction.motionInteraction.confidence}`,
    '',
    ...renderSubBulletList('Patterns', extraction.motionInteraction.patterns),
    ...renderSubBulletList('Notes', extraction.motionInteraction.notes),
    '',
    '## Ingredients',
    '',
    ...renderIngredientLayerMarkdown(extraction.ingredients),
    '',
    "## Do's",
    '',
    ...renderBulletList(extraction.dos),
    '',
    "## Don'ts",
    '',
    ...renderBulletList(extraction.donts),
    '',
    '## Source Evidence',
    '',
    ...renderBulletList(uniqueStrings([
      record.sourceUrl || null,
      record.userNote || null,
      ...extraction.sourceEvidence,
    ])),
  ];

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

export function renderLibraryDesignMarkdown(synthesis) {
  const lines = [
    '# Library Design System',
    '',
    '## Overview',
    '',
    synthesis.overview,
    '',
    '## Stable Shared Patterns',
    '',
    ...renderBulletList(synthesis.stablePatterns),
    '',
    '## Anti-Patterns',
    '',
    ...renderBulletList(synthesis.antiPatterns),
    '',
    '## Tensions',
    '',
    ...renderBulletList(synthesis.tensions),
    '',
    '## Branch Directions',
    '',
    ...renderBranchDirections(synthesis.branchDirections),
    '',
    '## Ingredients',
    '',
    ...renderIngredientLayerMarkdown(synthesis.ingredients),
    '',
    '## Colors',
    '',
    synthesis.colors.summary,
    '',
    ...renderSubBulletList('Recurring Tokens', synthesis.colors.recurringTokens),
    ...renderSubBulletList('Recurring Notes', synthesis.colors.recurringNotes),
    '',
    '## Typography',
    '',
    synthesis.typography.summary,
    '',
    ...renderSubBulletList('Recurring Patterns', synthesis.typography.recurringPatterns),
    '',
    '## Layout',
    '',
    synthesis.layout.summary,
    '',
    ...renderSubBulletList('Recurring Patterns', synthesis.layout.recurringPatterns),
    '',
    '## Components',
    '',
    synthesis.components.summary,
    '',
    ...renderSubBulletList('Recurring Patterns', synthesis.components.recurringPatterns),
    '',
    '## Imagery & Illustration',
    '',
    synthesis.imageryIllustration.summary,
    '',
    ...renderSubBulletList('Recurring Patterns', synthesis.imageryIllustration.recurringPatterns),
    '',
    '## Motion & Interaction',
    '',
    synthesis.motionInteraction.summary,
    '',
    `Confidence: ${synthesis.motionInteraction.confidence}`,
    '',
    ...renderSubBulletList('Recurring Patterns', synthesis.motionInteraction.recurringPatterns),
    '',
    "## Do's",
    '',
    ...renderBulletList(synthesis.dos),
    '',
    "## Don'ts",
    '',
    ...renderBulletList(synthesis.donts),
    '',
    '## Source Evidence',
    '',
    ...renderBulletList(synthesis.sourceEvidence),
  ];

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function normalizeInterestingRegions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const regions = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const title = normalizeText(item.title);
    if (!title) {
      continue;
    }
    regions.push({
      id: normalizeText(item.id) || slugify(title),
      title,
      kind: normalizeText(item.kind) || 'region',
      whyItMatters: normalizeText(item.whyItMatters) || 'This area concentrates important design decisions.',
      signals: normalizeStringArray(item.signals),
    });
  }
  return regions;
}

function normalizeColorSection(value) {
  return {
    summary: normalizeText(value?.summary) || 'Color choices reinforce structure and mood through restrained accents and clear contrast.',
    brandTokens: normalizeTokens(value?.brandTokens),
    surfaceTokens: normalizeTokens(value?.surfaceTokens),
    textTokens: normalizeTokens(value?.textTokens),
    semanticTokens: normalizeTokens(value?.semanticTokens),
    gradientNotes: normalizeStringArray(value?.gradientNotes),
  };
}

function normalizeTypographySection(value) {
  return {
    summary: normalizeText(value?.summary) || 'Typography decisions emphasize hierarchy, readability, and tonal consistency.',
    fontFamilies: normalizeFontFamilies(value?.fontFamilies),
    hierarchy: normalizeHierarchy(value?.hierarchy),
    principles: normalizeStringArray(value?.principles),
  };
}

function normalizeLayoutSection(value) {
  return {
    summary: normalizeText(value?.summary) || 'Layout relies on spacing, rhythm, and modular grouping to make complex content legible.',
    spacingSystem: normalizeStringArray(value?.spacingSystem),
    gridNotes: normalizeStringArray(value?.gridNotes),
    responsiveStrategy: normalizeStringArray(value?.responsiveStrategy),
  };
}

function normalizeElevationSection(value) {
  return {
    summary: normalizeText(value?.summary) || 'Depth is conveyed with contrast, borders, and selective elevation cues.',
    levels: normalizeLevels(value?.levels),
  };
}

function normalizeShapesSection(value) {
  return {
    summary: normalizeText(value?.summary) || 'Shape language stays consistent enough to make the system feel deliberate.',
    radiusScale: normalizeRadiusScale(value?.radiusScale),
  };
}

function normalizeComponents(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const components = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const name = normalizeText(item.name);
    if (!name) {
      continue;
    }
    components.push({
      name,
      description: normalizeText(item.description) || 'A recurring design-system component.',
      properties: normalizeStringArray(item.properties),
    });
  }
  return components;
}

function normalizeImagerySection(value) {
  return {
    summary: normalizeText(value?.summary) || 'Imagery choices are integrated into the same design voice as the interface system.',
    styles: normalizeStringArray(value?.styles),
    behaviors: normalizeStringArray(value?.behaviors),
  };
}

function normalizeMotionSection(value) {
  return {
    summary: normalizeText(value?.summary) || 'Motion observations are limited by the static nature of the reference unless user notes add context.',
    confidence: normalizeText(value?.confidence) || 'static-inferred',
    patterns: normalizeStringArray(value?.patterns),
    notes: normalizeStringArray(value?.notes),
  };
}

function normalizeTokens(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const tokens = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const name = normalizeText(item.name);
    if (!name) {
      continue;
    }
    tokens.push({
      name,
      value: normalizeText(item.value) || 'Observed value',
      role: normalizeText(item.role) || 'General role',
    });
  }
  return tokens;
}

function normalizeFontFamilies(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const families = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const name = normalizeText(item.name);
    if (!name) {
      continue;
    }
    families.push({
      name,
      role: normalizeText(item.role) || 'Primary family',
      notes: normalizeText(item.notes) || '',
    });
  }
  return families;
}

function normalizeHierarchy(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const hierarchy = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const name = normalizeText(item.name);
    if (!name) {
      continue;
    }
    hierarchy.push({
      name,
      size: normalizeText(item.size) || '',
      weight: normalizeText(item.weight) || '',
      lineHeight: normalizeText(item.lineHeight) || '',
      letterSpacing: normalizeText(item.letterSpacing) || '',
      use: normalizeText(item.use) || '',
    });
  }
  return hierarchy;
}

function normalizeLevels(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const levels = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const name = normalizeText(item.name);
    if (!name) {
      continue;
    }
    levels.push({
      name,
      treatment: normalizeText(item.treatment) || '',
      use: normalizeText(item.use) || '',
    });
  }
  return levels;
}

function normalizeRadiusScale(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const items = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const name = normalizeText(item.name);
    if (!name) {
      continue;
    }
    items.push({
      name,
      value: normalizeText(item.value) || '',
      use: normalizeText(item.use) || '',
    });
  }
  return items;
}

function renderInterestingRegions(regions) {
  if (!Array.isArray(regions) || regions.length === 0) {
    return ['- No notable regions were extracted yet.'];
  }

  const lines = [];
  for (const region of regions) {
    lines.push(`- **${region.title}** (${region.kind}): ${region.whyItMatters}`);
    if (region.signals.length > 0) {
      lines.push(`Signals: ${region.signals.join(', ')}`);
    }
  }
  return lines;
}

function renderTokenSection(title, tokens) {
  return [
    `### ${title}`,
    '',
    ...renderTokenTable(tokens),
    '',
  ];
}

function renderTokenTable(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return ['No explicit tokens extracted yet.'];
  }

  const lines = [
    '| Name | Value | Role |',
    '| --- | --- | --- |',
  ];
  for (const token of tokens) {
    lines.push(`| ${escapePipe(token.name)} | ${escapePipe(token.value)} | ${escapePipe(token.role)} |`);
  }
  return lines;
}

function renderFontFamilies(families) {
  const lines = ['### Font Families', ''];
  if (!Array.isArray(families) || families.length === 0) {
    lines.push('No explicit font families extracted yet.', '');
    return lines;
  }

  for (const family of families) {
    lines.push(`- **${family.name}**: ${family.role}${family.notes ? ` — ${family.notes}` : ''}`);
  }
  lines.push('');
  return lines;
}

function renderHierarchyTable(items) {
  const lines = ['### Hierarchy', ''];
  if (!Array.isArray(items) || items.length === 0) {
    lines.push('No hierarchy table extracted yet.', '');
    return lines;
  }

  lines.push('| Token | Size | Weight | Line Height | Letter Spacing | Use |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const item of items) {
    lines.push(
      `| ${escapePipe(item.name)} | ${escapePipe(item.size)} | ${escapePipe(item.weight)} | ${escapePipe(item.lineHeight)} | ${escapePipe(item.letterSpacing)} | ${escapePipe(item.use)} |`
    );
  }
  lines.push('');
  return lines;
}

function renderLevelTable(items) {
  const lines = ['| Level | Treatment | Use |', '| --- | --- | --- |'];
  if (!Array.isArray(items) || items.length === 0) {
    lines.push('| None recorded |  |  |');
    return lines;
  }
  for (const item of items) {
    lines.push(`| ${escapePipe(item.name)} | ${escapePipe(item.treatment)} | ${escapePipe(item.use)} |`);
  }
  return lines;
}

function renderRadiusTable(items) {
  const lines = ['| Token | Value | Use |', '| --- | --- | --- |'];
  if (!Array.isArray(items) || items.length === 0) {
    lines.push('| None recorded |  |  |');
    return lines;
  }
  for (const item of items) {
    lines.push(`| ${escapePipe(item.name)} | ${escapePipe(item.value)} | ${escapePipe(item.use)} |`);
  }
  return lines;
}

function renderComponents(components) {
  if (!Array.isArray(components) || components.length === 0) {
    return ['- No components extracted yet.'];
  }

  const lines = [];
  for (const component of components) {
    lines.push(`### ${component.name}`, '', component.description, '');
    lines.push(...renderBulletList(component.properties));
    lines.push('');
  }
  return lines;
}

function renderSubBulletList(title, items) {
  return [
    `### ${title}`,
    '',
    ...renderBulletList(items),
    '',
  ];
}

function renderBulletList(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return ['- None recorded yet.'];
  }
  return items.map((item) => `- ${item}`);
}

function renderBranchDirections(branches) {
  if (!Array.isArray(branches) || branches.length === 0) {
    return ['- No branch directions synthesized yet.'];
  }

  const lines = [];
  for (const branch of branches) {
    lines.push(`### ${branch.id}`, '', branch.thesis || 'No thesis recorded yet.', '');
    const cueLines = uniqueStrings([
      ...normalizeStringArray(branch.paletteNotes),
      ...normalizeStringArray(branch.typographyNotes),
      ...normalizeStringArray(branch.compositionNotes),
      ...normalizeStringArray(branch.imageryNotes),
    ]);
    lines.push(...renderBulletList(cueLines));
    lines.push('');
  }
  return lines;
}

function renderIngredientLayerMarkdown(layer) {
  const normalized = normalizeIngredientLayer(layer);
  const lines = [];

  lines.push('### Visual Ingredients', '');
  lines.push(...renderIngredientFamily('Typography', normalized.visual.typography));
  lines.push(...renderIngredientFamily('Palette', normalized.visual.palette));
  lines.push(...renderIngredientFamily('Layout Rhythm', normalized.visual.layoutRhythm));
  lines.push(...renderIngredientFamily('Imagery Mode', normalized.visual.imageryMode));
  lines.push(...renderIngredientFamily('Materiality', normalized.visual.materiality));
  lines.push(...renderIngredientFamily('Realism', normalized.visual.realism));
  lines.push(...renderIngredientFamily('Mood', normalized.visual.mood));
  lines.push(...renderIngredientFamily('Anti-Patterns', normalized.visual.antiPatterns));
  lines.push('### Page-Making Ingredients', '');
  lines.push(...renderIngredientFamily('Hero Posture', normalized.pageMaking.heroPosture));
  lines.push(...renderIngredientFamily('Proof Style', normalized.pageMaking.proofStyle));
  lines.push(...renderIngredientFamily('CTA Tone', normalized.pageMaking.ctaTone));
  lines.push(...renderIngredientFamily('Section Pacing', normalized.pageMaking.sectionPacing));
  lines.push(...renderIngredientFamily('Install Visibility', normalized.pageMaking.installVisibility));
  lines.push(...renderIngredientFamily('Artifact Display Strategy', normalized.pageMaking.artifactDisplayStrategy));

  return lines;
}

function renderIngredientFamily(title, items) {
  const lines = [`#### ${title}`, ''];
  if (!Array.isArray(items) || items.length === 0) {
    lines.push('- None recorded yet.', '');
    return lines;
  }

  for (const item of items) {
    lines.push(`- **${item.label}**${item.detail ? `: ${item.detail}` : ''}`);
    if (item.signals.length > 0) {
      lines.push(`Signals: ${item.signals.join(', ')}`);
    }
    if (item.sourcePointers.length > 0) {
      lines.push(`Pointers: ${item.sourcePointers.map((pointer) => `${pointer.kind}=${pointer.value}${pointer.note ? ` (${pointer.note})` : ''}`).join(' · ')}`);
    }
  }
  lines.push('');
  return lines;
}

function buildReferenceExplainArtifact({ record, extraction }) {
  return {
    generatedAt: new Date().toISOString(),
    level: 'reference',
    recordId: record.id,
    sourceUrl: record.sourceUrl || null,
    sourcePath: record.sourcePath || null,
    overview: `This explain artifact shows how one saved reference contributes reusable taste ingredients and page-making cues.`,
    ingredients: extraction.ingredients,
    interestingRegions: extraction.interestingRegions,
    sourceEvidence: uniqueStrings([
      record.userNote || null,
      record.sourceUrl || null,
      ...extraction.sourceEvidence,
    ]),
  };
}

function renderReferenceExplainMarkdown(explain) {
  const lines = [
    '# Reference Explain',
    '',
    explain.overview,
    '',
    '## Ingredients',
    '',
    ...renderIngredientLayerMarkdown(explain.ingredients),
    '## Interesting Regions',
    '',
    ...renderInterestingRegions(explain.interestingRegions),
    '',
    '## Source Evidence',
    '',
    ...renderBulletList(explain.sourceEvidence),
  ];

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function buildFallbackTokens(values, labelPrefix) {
  return normalizeStringArray(values).slice(0, 3).map((value, index) => ({
    name: `${labelPrefix} ${index + 1}`,
    value: value,
    role: 'Observed visual cue',
  }));
}

function buildAggregatedIngredientLayer(extractions) {
  const empty = buildEmptyIngredientLayer();
  const visualFamilies = Object.keys(empty.visual);
  const pageFamilies = Object.keys(empty.pageMaking);

  return {
    visual: Object.fromEntries(visualFamilies.map((family) => [
      family,
      aggregateIngredientFamily(extractions, `visual.${family}`),
    ])),
    pageMaking: Object.fromEntries(pageFamilies.map((family) => [
      family,
      aggregateIngredientFamily(extractions, `pageMaking.${family}`),
    ])),
  };
}

function aggregateIngredientFamily(extractions, familyPath) {
  const items = [];
  for (const { extraction, record } of extractions) {
    const familyItems = resolveIngredientFamilyItems(extraction.ingredients, familyPath);
    for (const item of familyItems) {
      items.push({
        ...item,
        sourceRecordIds: uniqueStrings([
          ...(item.sourceRecordIds || []),
          record.id,
        ]),
      });
    }
  }

  const grouped = new Map();
  for (const item of items) {
    const existing = grouped.get(item.id);
    if (!existing) {
      grouped.set(item.id, {
        ...item,
        count: item.count || 1,
      });
      continue;
    }

    existing.count += 1;
    existing.sourceRecordIds = uniqueStrings([
      ...existing.sourceRecordIds,
      ...item.sourceRecordIds,
    ]);
    existing.signals = uniqueStrings([
      ...existing.signals,
      ...item.signals,
    ]).slice(0, 8);
    existing.sourcePointers = dedupePointers([
      ...existing.sourcePointers,
      ...item.sourcePointers,
    ]).slice(0, 8);
  }

  return Array.from(grouped.values())
    .sort((left, right) => {
      if ((right.count || 0) !== (left.count || 0)) {
        return (right.count || 0) - (left.count || 0);
      }
      return left.label.localeCompare(right.label);
    })
    .slice(0, 8);
}

function resolveIngredientFamilyItems(layer, familyPath) {
  const [scope, family] = familyPath.split('.');
  if (!layer || typeof layer !== 'object') {
    return [];
  }
  return Array.isArray(layer?.[scope]?.[family]) ? layer[scope][family] : [];
}

function flattenIngredientLayer(layer) {
  const normalized = normalizeIngredientLayer(layer);
  return [
    ...Object.values(normalized.visual).flat(),
    ...Object.values(normalized.pageMaking).flat(),
  ];
}

function buildRealismSignals({ record, extraction, materials, imagerySignals }) {
  const sourceBlob = [
    record?.userNote || '',
    record?.sourceUrl || '',
    ...extraction.sourceEvidence,
    ...materials,
    ...imagerySignals,
  ].join(' ').toLowerCase();

  const physicalHit = ['clothespin', 'paper', 'mesh', 'lighting', 'physical', 'tactile', 'packaging', 'ephemera'].some((term) => sourceBlob.includes(term));
  const screenHit = ['screenshot', 'ui', 'hero', 'product', 'screen'].some((term) => sourceBlob.includes(term));

  if (physicalHit) {
    return {
      label: 'Physical realism',
      detail: 'The reference feels grounded in real materials, lighting, and imperfect physical arrangement.',
      signals: uniqueStrings([
        ...materials.slice(0, 4),
        ...imagerySignals.slice(0, 2),
        'Real-world lighting',
        'Material honesty',
      ]),
    };
  }

  if (screenHit) {
    return {
      label: 'Product-proof realism',
      detail: 'The reference keeps realism through interface proof, concrete screenshots, or system evidence rather than abstract spectacle.',
      signals: uniqueStrings([
        ...imagerySignals.slice(0, 4),
        ...extraction.interestingRegions.map((region) => region.title).slice(0, 2),
      ]),
    };
  }

  return {
    label: 'Curated realism',
    detail: 'The reference balances curation and believability without feeling synthetic or over-smoothed.',
    signals: uniqueStrings([
      ...imagerySignals.slice(0, 3),
      ...materials.slice(0, 3),
    ]),
  };
}

function buildMaterialityLabel(materials) {
  const blob = materials.join(' ').toLowerCase();
  if (blob.includes('paper') || blob.includes('clothespin') || blob.includes('mesh')) {
    return 'Tactile material stack';
  }
  if (blob.includes('gradient') || blob.includes('shadow') || blob.includes('digital')) {
    return 'Digital material finish';
  }
  return materials[0] || 'Material signature';
}

function buildHeroPostureLabel({ record, extraction }) {
  if (record?.sourceType === 'local-image' && extraction.interestingRegions.some((region) => /poster|grid|wall/i.test(region.title))) {
    return 'Physical focal wall';
  }
  if (extraction.colors.gradientNotes.length > 0) {
    return 'Atmospheric hero field';
  }
  return 'System-forward hero posture';
}

function buildProofStyleLabel({ record, extraction }) {
  if (record?.sourceType === 'local-image') {
    return 'Found artifact proof';
  }
  if (extraction.components.some((component) => /card|table|mockup|screenshot/i.test(component.name))) {
    return 'Structured product proof';
  }
  return 'Curated modular proof';
}

function buildCtaToneLabel(extraction, record) {
  if (record?.sourceType === 'local-image') {
    return 'Earned and understated CTA tone';
  }
  if (extraction.colors.brandTokens.length > 0) {
    return 'High-contrast decisive CTA tone';
  }
  return 'Clear but restrained CTA tone';
}

function collectStablePatterns(extractions, tasteSummary) {
  return [
    ...collectStringSection(extractions, (item) => item.extraction.keyCharacteristics),
    ...collectStringSection(extractions, (item) => item.extraction.typography?.principles),
    ...collectStringSection(extractions, (item) => item.extraction.layout?.spacingSystem),
    ...collectStringSection(extractions, (item) => item.extraction.layout?.gridNotes),
    ...collectStringSection(extractions, (item) => item.extraction.colors?.gradientNotes),
    ...collectStringSection(extractions, (item) => item.extraction.imageryIllustration?.styles),
    ...normalizeStringArray(tasteSummary?.stablePreferences),
  ];
}

function collectAntiPatterns(extractions) {
  return collectStringSection(extractions, (item) => item.extraction.donts);
}

function collectNamedValues(extractions, sectionName) {
  const results = [];
  for (const { extraction } of extractions) {
    const section = extraction[sectionName];
    if (!section) {
      continue;
    }
    const tokenGroups = [
      ...(section.brandTokens || []),
      ...(section.surfaceTokens || []),
      ...(section.textTokens || []),
      ...(section.semanticTokens || []),
    ];
    for (const token of tokenGroups) {
      results.push(`${token.name}: ${token.role}`);
    }
  }
  return results;
}

function collectComponentNames(extractions) {
  const names = [];
  for (const { extraction } of extractions) {
    for (const component of extraction.components || []) {
      names.push(component.name);
    }
  }
  return names;
}

function collectComponentProperties(extractions) {
  const properties = [];
  for (const { extraction } of extractions) {
    for (const component of extraction.components || []) {
      properties.push(...normalizeStringArray(component.properties));
    }
  }
  return properties;
}

function collectStringSection(extractions, selector) {
  const values = [];
  for (const extraction of extractions) {
    const selected = selector(extraction);
    if (Array.isArray(selected)) {
      values.push(...normalizeStringArray(selected));
    } else if (typeof selected === 'string') {
      values.push(selected);
    }
  }
  return values;
}

function inferDesignTensions(extractions) {
  const tokens = collectStablePatterns(extractions, null).map((value) => value.toLowerCase());
  const tensions = [];
  if (tokens.some((value) => value.includes('editorial')) && tokens.some((value) => value.includes('system'))) {
    tensions.push('Editorial expression vs system discipline');
  }
  if (tokens.some((value) => value.includes('warm')) && tokens.some((value) => value.includes('technical'))) {
    tensions.push('Human warmth vs technical clarity');
  }
  return tensions;
}

function buildLibraryOverview({ sourceCount, stablePatterns, tensions }) {
  const stableLead = stablePatterns.slice(0, 4).join(', ') || 'clarity, hierarchy, and controlled contrast';
  const tensionLead = tensions.slice(0, 2).join('; ') || 'a pull between rigor and warmth';
  return `This composite library design system is synthesized from ${sourceCount} extracted references. The most stable shared patterns are ${stableLead}. The most important tensions are ${tensionLead}.`;
}

function summarizeSection(values, fallback) {
  const normalized = uniqueStrings(values.filter((value) => typeof value === 'string' && value.trim()));
  return normalized[0] || fallback;
}

function normalizeBranchDirections(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => item && typeof item === 'object' && normalizeText(item.id))
    .map((item) => ({
      id: normalizeText(item.id),
      thesis: normalizeText(item.thesis) || '',
      paletteNotes: normalizeStringArray(item.paletteNotes),
      typographyNotes: normalizeStringArray(item.typographyNotes),
      compositionNotes: normalizeStringArray(item.compositionNotes),
      imageryNotes: normalizeStringArray(item.imageryNotes),
      avoidNotes: normalizeStringArray(item.avoidNotes),
    }));
}

function topStrings(values, limit = 8) {
  const counts = {};
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    counts[trimmed] = (counts[trimmed] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([key]) => key);
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return uniqueStrings(value);
}

function uniqueStrings(values) {
  const normalized = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed || normalized.includes(trimmed)) {
      continue;
    }
    normalized.push(trimmed);
  }
  return normalized;
}

function splitHints(value) {
  if (typeof value !== 'string') {
    return [];
  }
  return value
    .split(/[,\n.]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function escapePipe(value) {
  return String(value || '').replace(/\|/g, '\\|');
}

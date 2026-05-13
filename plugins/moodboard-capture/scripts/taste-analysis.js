#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';

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

export async function analyzeCaptureTaste({
  assetPath,
  sourceType,
  sourceUrl,
  userNote,
  tags,
  whyLiked,
  styleCues,
}) {
  const mode = resolveAnalysisMode();

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
}) {
  const imageDataUrl = await buildImageDataUrl(assetPath);
  const prompt = buildAnalysisPrompt({
    sourceType,
    sourceUrl,
    userNote,
    tags,
    whyLiked,
    styleCues,
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
          content: 'You are a design taste analyst. Return strict JSON only.',
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

  return normalizeTasteAnalysis(parsed);
}

function buildAnalysisPrompt({
  sourceType,
  sourceUrl,
  userNote,
  tags,
  whyLiked,
  styleCues,
}) {
  const lines = [
    'Analyze this design inspiration artifact and extract taste-memory signals for future AI-assisted design work.',
    'Return JSON with exactly these top-level keys: visualTraits, whyItWorks, designSignals, profileContributions, summary.',
    'Rules:',
    '- Be concrete, not generic.',
    '- Focus on visually observable traits plus likely design logic.',
    '- Keep strings concise and reusable.',
    '- Use arrays of short phrases for list fields.',
    '- Do not mention uncertainty unless the image is genuinely ambiguous.',
    '',
    `sourceType: ${sourceType}`,
    `sourceUrl: ${sourceUrl || ''}`,
    `userNote: ${userNote || ''}`,
    `legacyTags: ${(tags || []).join(', ')}`,
    `legacyWhyLiked: ${whyLiked || ''}`,
    `legacyStyleCues: ${(styleCues || []).join(', ')}`,
    '',
    'JSON schema expectations:',
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

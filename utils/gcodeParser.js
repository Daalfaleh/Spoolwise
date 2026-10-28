const textDecoder = new TextDecoder();
const MAX_GCODE_READ_BYTES = 8 * 1024 * 1024;
const MAX_3MF_BYTES = 128 * 1024 * 1024;
const MAX_ARCHIVE_ENTRY_BYTES = 64 * 1024 * 1024;
const MAX_ARCHIVE_TEXT_BYTES = 12 * 1024 * 1024;

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function numberList(value) {
  return String(value ?? "")
    .match(/-?\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter((number) => Number.isFinite(number) && number >= 0) ?? [];
}

function matchingValues(text, pattern) {
  const values = [];
  for (const match of text.matchAll(pattern)) {
    const total = numberList(match[1]).reduce((sum, value) => sum + value, 0);
    if (total > 0) values.push(total);
  }
  return values;
}

function lastPositive(values) {
  return [...values].reverse().find((value) => value > 0) ?? 0;
}

function maxMatchedValue(text, patterns) {
  return Math.max(0, ...patterns.flatMap((pattern) => matchingValues(text, pattern)));
}

export function parseDurationSeconds(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return 0;

  if (/^\d+(?::\d+){1,2}$/.test(normalized)) {
    const parts = normalized.split(":").map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  const units = { d: 86400, h: 3600, m: 60, s: 1 };
  let seconds = 0;
  for (const match of normalized.matchAll(/(\d+(?:\.\d+)?)\s*([dhms])/g)) {
    seconds += Number(match[1]) * units[match[2]];
  }
  if (seconds > 0) return Math.round(seconds);

  return /^\d+(?:\.\d+)?$/.test(normalized) ? Math.round(Number(normalized)) : 0;
}

function detectSlicer(text) {
  if (/bambu\s*studio/i.test(text)) return "Bambu Studio";
  if (/orca\s*slicer/i.test(text)) return "OrcaSlicer";
  if (/prusa\s*slicer/i.test(text)) return "PrusaSlicer";
  if (/cura(?:_steamengine)?/i.test(text)) return "Cura";
  return "Unknown slicer";
}

function convertedFilamentGrams(text) {
  const millimeters = lastPositive(matchingValues(
    text,
    /(?:^|\n)\s*;?\s*filament used\s*\[mm\]\s*[:=]\s*([^\r\n;]+)/gim,
  ));
  if (millimeters <= 0) return 0;

  const diameter = finitePositive(text.match(/(?:^|\n)\s*;?\s*filament_diameter\s*[:=]\s*([\d.]+)/im)?.[1]) || 1.75;
  const density = finitePositive(text.match(/(?:^|\n)\s*;?\s*filament_density\s*[:=]\s*([\d.]+)/im)?.[1]) || 1.24;
  const cubicMillimeters = Math.PI * (diameter / 2) ** 2 * millimeters;
  return (cubicMillimeters / 1000) * density;
}

export function parseGcodeText(text, options = {}) {
  const sourceText = String(text ?? "");
  const totalGrams = lastPositive(matchingValues(
    sourceText,
    /(?:^|\n)\s*;?\s*total filament used\s*\[g\]\s*[:=]\s*([^\r\n;]+)/gim,
  ));
  const listedGrams = lastPositive(matchingValues(
    sourceText,
    /(?:^|\n)\s*;?\s*(?!total\s)filament used\s*\[g\]\s*[:=]\s*([^\r\n;]+)/gim,
  ));
  const metadataGrams = maxMatchedValue(sourceText, [
    /["'](?:filament_weight|filament_used_g|total_weight)["']\s*:\s*["']?([\d., ]+)/gim,
  ]);

  const flushGrams = maxMatchedValue(sourceText, [
    /(?:^|\n)\s*;?\s*(?:total\s+)?(?:flush|flushed|purge|purged)(?:\s+filament)?(?:\s+weight)?\s*\[g\]\s*[:=]\s*([^\r\n;]+)/gim,
    /["'](?:flush_weight|flush_weight_g|purge_weight|purge_weight_g)["']\s*:\s*["']?([\d., ]+)/gim,
  ]);
  const towerGrams = maxMatchedValue(sourceText, [
    /(?:^|\n)\s*;?\s*total filament used for (?:wipe|prime) tower\s*\[g\]\s*[:=]\s*([^\r\n;]+)/gim,
    /(?:^|\n)\s*;?\s*(?:wipe|prime) tower(?:\s+filament)?(?:\s+weight)?\s*\[g\]\s*[:=]\s*([^\r\n;]+)/gim,
    /["'](?:wipe_tower_weight|prime_tower_weight)["']\s*:\s*["']?([\d., ]+)/gim,
  ]);
  const wasteWeightGrams = flushGrams + towerGrams;
  const measuredTotal = totalGrams || listedGrams || metadataGrams || convertedFilamentGrams(sourceText);
  const modelWeightGrams = measuredTotal > 0
    ? Math.max(0, measuredTotal - Math.min(measuredTotal, wasteWeightGrams))
    : 0;

  const durationCandidates = [];
  const durationPatterns = [
    /(?:^|\n)\s*;?\s*estimated printing time(?:\s*\([^)]*\))?\s*[:=]\s*([^\r\n;]+)/gim,
    /(?:^|\n)\s*;?\s*(?:model printing time|total estimated time|TIME)\s*[:=]\s*([^\r\n;]+)/gm,
    /["'](?:prediction|estimated_time|print_time)["']\s*:\s*["']?([\dhms: .]+)/gim,
  ];
  for (const pattern of durationPatterns) {
    for (const match of sourceText.matchAll(pattern)) {
      const seconds = parseDurationSeconds(match[1]);
      if (seconds > 0) durationCandidates.push(seconds);
    }
  }
  const durationSeconds = Math.max(0, ...durationCandidates);

  const warnings = [];
  if (!measuredTotal) warnings.push("No filament weight was found in the sliced file metadata.");
  if (!durationSeconds) warnings.push("No estimated print duration was found in the sliced file metadata.");
  if (!wasteWeightGrams) warnings.push("No explicit purge, flush, or tower waste weight was reported by the slicer.");

  return {
    fileName: String(options.fileName ?? ""),
    slicer: detectSlicer(sourceText),
    modelWeightGrams: Number(modelWeightGrams.toFixed(2)),
    wasteWeightGrams: Number(wasteWeightGrams.toFixed(2)),
    totalWeightGrams: Number((measuredTotal || wasteWeightGrams).toFixed(2)),
    durationSeconds,
    warnings,
  };
}

function findEndOfCentralDirectory(view) {
  const minimum = Math.max(0, view.byteLength - 65557);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return -1;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot decompress sliced 3MF files.");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function relevantZipText(buffer) {
  const view = new DataView(buffer);
  const endOffset = findEndOfCentralDirectory(view);
  if (endOffset < 0) throw new Error("The 3MF archive is invalid or incomplete.");

  const entryCount = view.getUint16(endOffset + 10, true);
  let offset = view.getUint32(endOffset + 16, true);
  if (entryCount > 512) throw new Error("The 3MF archive contains too many files.");

  const textParts = [];
  let textBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("The 3MF file directory is invalid.");
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nameBytes = new Uint8Array(buffer, offset + 46, nameLength);
    const name = textDecoder.decode(nameBytes);
    offset += 46 + nameLength + extraLength + commentLength;

    if (!/\.(?:gcode|config|json|xml|model)$/i.test(name)) continue;
    if (uncompressedSize > MAX_ARCHIVE_ENTRY_BYTES || textBytes + uncompressedSize > MAX_ARCHIVE_TEXT_BYTES) continue;
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("A 3MF archive entry is invalid.");
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = new Uint8Array(buffer, dataOffset, compressedSize);
    const contents = method === 0 ? compressed : method === 8 ? await inflateRaw(compressed) : null;
    if (!contents) continue;
    textBytes += contents.byteLength;
    textParts.push(`\n; archive entry: ${name}\n${textDecoder.decode(contents)}`);
  }

  if (!textParts.length) throw new Error("No sliced G-code or slicer metadata was found inside this 3MF file.");
  return textParts.join("\n");
}

export async function parse3mfBuffer(buffer, options = {}) {
  if (!(buffer instanceof ArrayBuffer)) throw new TypeError("Expected a 3MF ArrayBuffer.");
  if (buffer.byteLength > MAX_3MF_BYTES) throw new Error("The 3MF file is larger than the 128 MB browser limit.");
  const text = await relevantZipText(buffer);
  return parseGcodeText(text, options);
}

async function boundedGcodeText(file) {
  if (file.size <= MAX_GCODE_READ_BYTES) return file.text();
  const head = await file.slice(0, 2 * 1024 * 1024).text();
  const tail = await file.slice(-6 * 1024 * 1024).text();
  return `${head}\n${tail}`;
}

export async function parsePrintFile(file) {
  const fileName = String(file?.name ?? "");
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "gcode" || extension === "gco") {
    return parseGcodeText(await boundedGcodeText(file), { fileName });
  }
  if (extension === "3mf") {
    return parse3mfBuffer(await file.arrayBuffer(), { fileName });
  }
  throw new Error("Choose a sliced .gcode or .3mf file.");
}


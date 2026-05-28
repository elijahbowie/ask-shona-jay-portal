#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const roots = [
  "Office Hours Recordings",
  "Updated Trainings"
];

const mediaExtensions = new Set([".mp3", ".mp4", ".m4a", ".mov", ".wav"]);
const outputRoot = "Transcriptions";
const model = process.env.WHISPER_MODEL || "base.en";
const device = process.env.WHISPER_DEVICE || "cpu";
const threads = process.env.WHISPER_THREADS || "8";

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
      continue;
    }
    if (entry.isFile() && mediaExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

async function durationSeconds(file) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nk=1:nw=1",
    file
  ]);
  return Number(stdout.trim() || 0);
}

function outputDirFor(file) {
  const root = roots.find((item) => file.startsWith(`${item}${path.sep}`));
  const relativeDir = root ? path.dirname(path.relative(root, file)) : path.dirname(file);
  return path.join(outputRoot, root || "Other", relativeDir);
}

function baseName(file) {
  return path.basename(file, path.extname(file));
}

async function writeMarkdownTranscript(file, outputDir, duration) {
  const txtPath = path.join(outputDir, `${baseName(file)}.txt`);
  const jsonPath = path.join(outputDir, `${baseName(file)}.json`);
  const mdPath = path.join(outputDir, `${baseName(file)}.md`);
  const transcript = existsSync(txtPath) ? await readFile(txtPath, "utf8") : "";
  let segments = [];
  if (existsSync(jsonPath)) {
    const json = JSON.parse(await readFile(jsonPath, "utf8"));
    segments = Array.isArray(json.segments) ? json.segments : [];
  }

  const timestamped = segments
    .map((segment) => `- [${formatTime(segment.start)} - ${formatTime(segment.end)}] ${String(segment.text || "").trim()}`)
    .join("\n");

  const markdown = `# ${baseName(file)}

**Source file:** \`${file}\`  
**Duration:** ${formatDuration(duration)}  
**Transcription model:** Whisper ${model}  
**Generated:** ${new Date().toISOString()}

## Clean Transcript

${transcript.trim()}

## Timestamped Segments

${timestamped || "_Timestamped segment data was not available._"}
`;

  await writeFile(mdPath, markdown);
  return mdPath;
}

function formatDuration(seconds) {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remaining}s`;
  }
  return `${minutes}m ${remaining}s`;
}

function formatTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  return [hours, minutes, remaining].map((value) => String(value).padStart(2, "0")).join(":");
}

async function transcribe(file, index, total) {
  const outDir = outputDirFor(file);
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `${baseName(file)}.json`);
  const txtPath = path.join(outDir, `${baseName(file)}.txt`);
  const duration = await durationSeconds(file);
  if (existsSync(jsonPath) && existsSync(txtPath)) {
    const mdPath = await writeMarkdownTranscript(file, outDir, duration);
    console.log(`[${index}/${total}] skipped existing transcript: ${file}`);
    console.log(`  markdown: ${mdPath}`);
    return;
  }

  console.log(`[${index}/${total}] transcribing ${formatDuration(duration)}: ${file}`);
  await execFileAsync("whisper", [
    file,
    "--model",
    model,
    "--device",
    device,
    "--language",
    "en",
    "--task",
    "transcribe",
    "--output_dir",
    outDir,
    "--output_format",
    "all",
    "--threads",
    threads,
    "--verbose",
    "False"
  ], {
    maxBuffer: 12 * 1024 * 1024
  });
  const mdPath = await writeMarkdownTranscript(file, outDir, duration);
  console.log(`  markdown: ${mdPath}`);
}

async function main() {
  const files = [];
  for (const root of roots) {
    if (existsSync(root)) {
      files.push(...await walk(root));
    }
  }
  files.sort((left, right) => left.localeCompare(right));
  console.log(`Found ${files.length} media files.`);
  for (let index = 0; index < files.length; index += 1) {
    await transcribe(files[index], index + 1, files.length);
  }
  console.log("Transcription run complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

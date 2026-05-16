/**
 * sync-media.js
 * 
 * Reads each project folder under List/ and auto-updates the media paths
 * in List/interplay_projects.json to match what's actually on disk.
 * 
 * Usage:  node sync-media.js
 * 
 * Folder convention:
 *   List/<Project_Folder>/final_images/      → media.final_images
 *   List/<Project_Folder>/behind_the_scenes/ → media.behind_the_scenes
 *   List/<Project_Folder>/artist_photos/     → media.artist_photos
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const LIST_DIR = path.join(ROOT_DIR, 'List');
const JSON_PATH = path.join(LIST_DIR, 'interplay_projects.json');

const MEDIA_SUBFOLDERS = ['final_images', 'behind_the_scenes', 'artist_photos'];
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov', '.svg']);

function listFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => !f.startsWith('.') && IMAGE_EXTS.has(path.extname(f).toLowerCase()))
        .sort();
}

// Build a map: normalised folder name → { final_images: [...], behind_the_scenes: [...], artist_photos: [...] }
function buildFolderMap() {
    const map = {};
    const entries = fs.readdirSync(LIST_DIR, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const folderName = entry.name;
        const folderPath = path.join(LIST_DIR, folderName);
        const media = {};
        for (const sub of MEDIA_SUBFOLDERS) {
            const subPath = path.join(folderPath, sub);
            const files = listFiles(subPath);
            media[sub] = files.map(f => `List/${folderName}/${sub}/${f}`);
        }
        // key: normalised lowercase folder name for fuzzy matching
        map[folderName.toLowerCase()] = { folderName, media };
    }
    return map;
}

// Convert a project_name to the likely folder name:
//   "Post Literature" → "Post_Literature"
//   "Infra/Seep"      → "Infra_Seep"
//   "Who gets to code?..." → "Who_gets_to_code"
function projectNameToFolderKey(name) {
    return name
        .replace(/[^a-zA-Z0-9 ]/g, '_')  // non-alphanumeric → underscore
        .replace(/\s+/g, '_')              // spaces → underscore
        .replace(/_+/g, '_')               // collapse multiple underscores
        .replace(/^_|_$/g, '')             // trim leading/trailing underscores
        .toLowerCase();
}

function main() {
    const raw = fs.readFileSync(JSON_PATH, 'utf8');
    const data = JSON.parse(raw);
    const folderMap = buildFolderMap();

    let updatedCount = 0;

    for (const project of data.projects) {
        const key = projectNameToFolderKey(project.project_name);

        // Try exact key first, then search for partial match
        let match = folderMap[key];
        if (!match) {
            // Partial match: folder key starts with or contains the project key
            const candidates = Object.keys(folderMap).filter(k =>
                k.startsWith(key.substring(0, Math.min(8, key.length)))
            );
            if (candidates.length === 1) match = folderMap[candidates[0]];
        }

        if (!match) {
            console.log(`⚠️  No folder found for: "${project.project_name}" (key: ${key})`);
            continue;
        }

        const { folderName, media } = match;

        // Only update if at least one subfolder has local files
        const hasLocalFiles = MEDIA_SUBFOLDERS.some(sub => media[sub].length > 0);
        if (!hasLocalFiles) {
            console.log(`–  Skipping "${project.project_name}" (no local files in ${folderName})`);
            continue;
        }

        // Merge: prefer local paths, keep existing non-local (SharePoint) if local is empty
        if (!project.media) project.media = {};

        for (const sub of MEDIA_SUBFOLDERS) {
            const localPaths = media[sub];
            const existing = project.media[sub] || [];
            const hasLocal = localPaths.length > 0;

            if (hasLocal) {
                // Replace with local paths (de-duplicate)
                const merged = [...new Set([...localPaths])];
                if (JSON.stringify(merged) !== JSON.stringify(existing)) {
                    project.media[sub] = merged;
                    console.log(`✅  ${project.project_name} / ${sub}: ${merged.length} file(s)`);
                    updatedCount++;
                }
            }
            // If no local files, leave existing value untouched
        }
    }

    fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.log(`\nDone. ${updatedCount} field(s) updated → List/interplay_projects.json`);
}

main();

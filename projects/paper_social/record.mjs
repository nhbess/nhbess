/**
 * Render the canvas animation to paper_social.mp4
 *
 * Usage:
 *   npm run video
 *   .\make-video.ps1
 *
 * Optional env: W=1920 H=1080 OUT=paper_social.mp4
 */

import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { spawn, spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIDTH = parseInt(process.env.W || "1920", 10);
const HEIGHT = parseInt(process.env.H || "1080", 10);
const OUT_VIDEO = path.resolve(__dirname, process.env.OUT || "paper_social.mp4");
const FFMPEG = resolveFfmpeg();

function resolveFfmpeg() {
  try {
    if (spawnSync(ffmpegInstaller.path, ["-version"], { stdio: "ignore" }).status === 0) {
      return ffmpegInstaller.path;
    }
  } catch (_) { /* bundled binary missing */ }
  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0) {
    return "ffmpeg";
  }
  console.error("ffmpeg not found — run: npm install");
  process.exit(1);
}

async function main() {
  const indexPath = path.join(__dirname, "index.html");
  const pageUrl = `${pathToFileURL(indexPath).href}?export=1&w=${WIDTH}&h=${HEIGHT}`;

  console.log(`Opening ${WIDTH}×${HEIGHT} export view…`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.goto(pageUrl, { waitUntil: "load", timeout: 120_000 });
    await page.waitForFunction(() => window.PaperSocialExport?.ready === true, {
      timeout: 60_000,
    });

    const meta = await page.evaluate(() => ({
      frameCount: window.PaperSocialExport.frameCount,
      fps: window.PaperSocialExport.fps,
    }));

    console.log(`Rendering ${meta.frameCount} frames @ ${meta.fps} fps…`);

    const ff = spawn(
      FFMPEG,
      [
        "-y",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "-framerate",
        String(meta.fps),
        "-i",
        "pipe:0",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "18",
        OUT_VIDEO,
      ],
      { stdio: ["pipe", "inherit", "inherit"] },
    );

    let lastPct = -1;
    await page.exposeFunction("__pipeJpeg", (b64) => {
      ff.stdin.write(Buffer.from(b64, "base64"));
    });
    await page.exposeFunction("__onProgress", (frame, total) => {
      const pct = Math.floor((frame / total) * 100);
      if (pct !== lastPct && pct % 5 === 0) {
        lastPct = pct;
        process.stdout.write(`\r  ${pct}%`);
      }
    });

    await page.evaluate(async () => {
      const total = window.PaperSocialExport.frameCount;
      await window.PaperSocialExport.run(async (f, b64) => {
        await window.__pipeJpeg(b64);
        if (f % 15 === 0 || f === total - 1) await window.__onProgress(f, total);
      });
    });

    ff.stdin.end();
    await new Promise((resolve, reject) => {
      ff.on("error", reject);
      ff.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
    });

    process.stdout.write("\r  100%\n");
    console.log("Saved:", OUT_VIDEO);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

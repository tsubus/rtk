// RTK - Rust Token Killer
// OMP extension: rewrite bash tool calls through `rtk rewrite`.
//
// This is a thin delegating extension. All rewrite logic lives in RTK's Rust
// registry via `rtk rewrite`, which remains the single source of truth.
//
// Fail-open: if rtk is unavailable or rewrite fails, commands run raw.

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { $which } from "@oh-my-pi/pi-utils";

async function rewrite(command: string): Promise<{ rewritten: string } | null> {
    // `rtk rewrite` exits 0 on a rewrite, 3 on "ask" (OMP has no native
    // permission prompt, so we rewrite anyway). Both are treated as success.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        const proc = Bun.spawn(["rtk", "rewrite", command], {
            stdout: "pipe", stderr: "ignore",
        });
        timeout = setTimeout(() => proc.kill(), 1_000);
        const [exitCode, stdout] = await Promise.all([
            proc.exited,
            new Response(proc.stdout).text(),
        ]);
        if ((exitCode === 0 || exitCode === 3) && stdout.trim()) {
            const rewritten = stdout.trim();
            return rewritten !== command ? { rewritten } : null;
        }
    } catch {
        // spawn failed, pipe broke, or timeout killed — passthrough
    } finally {
        if (timeout !== undefined) clearTimeout(timeout);
    }
    return null;
}

export default function rtkOmpExtension(pi: ExtensionAPI) {
    pi.setLabel("RTK");

    const hasRtk = Boolean($which("rtk"));

    pi.on("tool_call", async (event) => {
        if (event.toolName !== "bash") return;
        if (!hasRtk) return;
        const result = await rewrite(event.input.command);
        if (result) event.input.command = result.rewritten;
    });
}

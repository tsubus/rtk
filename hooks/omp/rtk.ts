// RTK - Rust Token Killer
// OMP hook: rewrite bash tool calls through `rtk rewrite`.
//
// Installed to .omp/hooks/pre/rtk.ts (project) or
// ~/.omp/agent/hooks/pre/rtk.ts (global).
// OMP auto-discovers and loads hooks from these paths.
//
// Fail-open: if rtk is unavailable or rewrite fails, commands run raw.

import type { HookAPI } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";
import { $which } from "@oh-my-pi/pi-utils";

type Verdict = "allow" | "ask";

interface RewriteResult {
    rewritten: string;
    verdict: Verdict;
}

async function rewrite(command: string): Promise<RewriteResult | null> {
    // `rtk rewrite` exit codes:
    //   0 = rewrite allowed (auto-apply)
    //   1 = no RTK equivalent (passthrough)
    //   2 = deny rule matched (block)
    //   3 = ask rule matched (prompt user before applying)
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
        const rewritten = stdout.trim();

        if (exitCode === 2) return null; // deny — block silently
        if ((exitCode === 0 || exitCode === 3) && rewritten && rewritten !== command) {
            return { rewritten, verdict: exitCode === 3 ? "ask" : "allow" };
        }
    } catch {
        // spawn failed, pipe broke, or timeout killed — passthrough
    } finally {
        if (timeout !== undefined) clearTimeout(timeout);
    }
    return null;
}

export default function (pi: HookAPI): void {
    const hasRtk = Boolean($which("rtk"));

    pi.on("tool_call", async (event, ctx) => {
        if (event.toolName !== "bash") return;
        if (!hasRtk) return;
        const result = await rewrite(event.input.command as string);
        if (!result) return;

        if (result.verdict === "ask" && ctx.hasUI) {
            const ok = await ctx.ui.confirm(
                "RTK rewrite",
                `Rewrote:\n  ${event.input.command}\nto:\n  ${result.rewritten}\n\nUse rewritten command?`,
            );
            if (!ok) return; // user declined — passthrough original
        }

        event.input.command = result.rewritten;
    });
}

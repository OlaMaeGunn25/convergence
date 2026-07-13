/*
   CONVERGENCE-Ai™ Global Error Boundary & Promise Rejection Handler
   Catches fatal runtime errors and async failures, reporting them directly in the UI console.
*/

export function initErrorBoundary() {
    window.addEventListener('error', (event) => {
        console.error("[GLOBAL ERROR BOUNDARY]", event.error || event.message);
        const errConsole = document.getElementById('logTerminal');
        if (errConsole) {
            const line = document.createElement('div');
            line.className = 'log-line error';
            line.innerHTML = `<span class="log-timestamp">[${new Date().toLocaleTimeString()}]</span> <span class="log-tag tag-error">[FATAL ERROR]</span> ${event.message}`;
            errConsole.appendChild(line);
            errConsole.scrollTop = errConsole.scrollHeight;
        }
    });

    window.addEventListener('unhandledrejection', (event) => {
        console.error("[GLOBAL UNHANDLED REJECTION]", event.reason);
        const errConsole = document.getElementById('logTerminal');
        const reasonMsg = event.reason?.message || event.reason || "Unknown promise rejection";
        if (errConsole) {
            const line = document.createElement('div');
            line.className = 'log-line warn';
            line.innerHTML = `<span class="log-timestamp">[${new Date().toLocaleTimeString()}]</span> <span class="log-tag tag-warn">[RUNTIME WARNING]</span> Promise rejected: ${reasonMsg}`;
            errConsole.appendChild(line);
            errConsole.scrollTop = errConsole.scrollHeight;
        }
    });
}

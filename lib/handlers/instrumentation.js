function handleInstrumentedNotTakenA() {
    if (global.g_cliArgs?.debug) {
        console.log(`[INSTRUMENTED_NOT_TAKEN] at offset ${this.code.Current.Offset}`);
    }
    // No-op marker for 3.14 instrumentation.
}

module.exports = {
    handleInstrumentedNotTakenA
};

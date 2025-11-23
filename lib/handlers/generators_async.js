const AST = require('../ast/ast_node');

function handleInstrumentedYieldValueA() {
    this.handleYieldValue();
}

function handleYieldValueA() {
    // Python 3.12+ YIELD_VALUE with argument
    // Call the actual handleYieldValue function in this context
    handleYieldValue.call(this);
}

function handleYieldValue() {
    let value = this.dataStack.pop();

    // Skip YIELD_VALUE if we're inside await machinery
    if (this.insideAwait) {
        if (global.g_cliArgs?.debug) {
            console.log(`[YIELD_VALUE] Skipping - inside await machinery`);
        }
        // Put value back on stack for END_SEND
        this.dataStack.push(value);
        return;
    }

    // Python 3.11+: YIELD_VALUE appears in async for loops as implementation detail
    // Skip if we're inside AsyncFor block and value looks like generator machinery
    if (this.object.Reader.versionCompare(3, 11) >= 0) {
        // Check if we're in an async for loop
        let inAsyncFor = false;
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            if (this.blocks[i].blockType == AST.ASTBlock.BlockType.AsyncFor) {
                inAsyncFor = true;
                break;
            }
        }

        if (inAsyncFor) {
            // Check if value is generator machinery (call to __anext__, etc.)
            // In async for context, YIELD_VALUE with awaitable is implementation detail
            if (value && (value.constructor.name === 'ASTCall' ||
                         value.constructor.name === 'ASTBinary' ||
                         value.constructor.name === 'ASTNone')) {
                if (global.g_cliArgs?.debug) {
                    console.log(`[YIELD_VALUE] Skipping generator machinery in async for: ${value.constructor.name}`);
                }
                // Don't append - this is implementation detail
                return;
            }
        }
    }

    let node = new AST.ASTReturn(value, AST.ASTReturn.RetType.Yield);
    node.line = this.code.Current.LineNo;
    this.curBlock.append(node);
}

function handleYieldFrom() {
    let dest = this.dataStack.pop();
    // TODO: Support yielding into a non-null destination
    let valueNode = this.dataStack.top();
    if (valueNode) {
        let node = new AST.ASTReturn(valueNode, AST.ASTReturn.RetType.YieldFrom);
        node.line = this.code.Current.LineNo;
        this.curBlock.append(node);
    }
}

function handleGetAwaitable() {
    let object = this.dataStack.pop();
    let node = new AST.ASTAwaitable (object);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);

    // Set flag: we're inside await machinery
    // SEND/YIELD_VALUE until END_SEND are implementation details
    this.insideAwait = true;
}

function handleGetAwaitableA() {
    // Python 3.11+ GET_AWAITABLE with argument
    handleGetAwaitable.call(this);
}

function handleGenStartA() {
    this.dataStack.pop();
}

function handleEndSend() {
    // Python 3.12+ END_SEND opcode
    // Ends a SEND operation in async generators/await
    // For decompilation: clear await flag, awaitable result is on stack
    if (global.g_cliArgs?.debug) {
        console.log(`[END_SEND] at offset ${this.code.Current.Offset}, insideAwait=${this.insideAwait}`);
    }

    // Clear await machinery flag
    this.insideAwait = false;
}

function handleInstrumentedEndSendA() {
    // Instrumented variant mirrors END_SEND behavior.
    handleEndSend.call(this);
}

function handleCleanupThrow() {
    // Python 3.12+ CLEANUP_THROW opcode
    // Exception cleanup in async generators
    // For decompilation: no-op, exception handling is implicit
    if (global.g_cliArgs?.debug) {
        console.log(`[CLEANUP_THROW] at offset ${this.code.Current.Offset}`);
    }
}

function handleSendA() {
    // Python 3.11+ SEND opcode
    // Used in async generators to send values into awaitables
    // Stack: TOS = value to send, TOS1 = awaitable
    // In async for context: sends None into __anext__() awaitable

    if (global.g_cliArgs?.debug) {
        console.log(`[SEND] at offset ${this.code.Current.Offset}, jump_target=${this.code.Current.Argument}`);
    }

    // For async for loops, SEND is part of iteration machinery
    // The awaitable (__anext__) is already on stack from GET_ANEXT
    // SEND will be followed by YIELD_VALUE (generator mechanics)
    // Result will be stored by subsequent STORE_FAST

    // Pop the send value (usually None for async for)
    let sendValue = this.dataStack.pop();

    // Keep awaitable on stack - YIELD_VALUE will handle it
    // Or if we're in a simple async for, it stays for STORE_FAST

    if (global.g_cliArgs?.debug) {
        console.log(`  Send value: ${sendValue?.constructor?.name}, stack depth: ${this.dataStack.length}`);
    }
}

function handleResumeA() {
    // Python 3.11+ RESUME opcode
    // Marks resumption points in generators/coroutines
    // Argument: 0=start, 1=yield, 2=yield from, 3=await

    if (global.g_cliArgs?.debug) {
        let resumeType = ['start', 'yield', 'yield_from', 'await'][this.code.Current.Argument] || 'unknown';
        console.log(`[RESUME ${resumeType}] at offset ${this.code.Current.Offset}`);
    }

    // No-op for decompiler - just marks resumption point for runtime optimization
}

function handleInstrumentedResumeA() {
    this.handleResumeA();
}

module.exports = {
    handleGetAwaitable,
    handleGetAwaitableA,
    handleYieldFrom,
    handleInstrumentedYieldValueA,
    handleYieldValueA,
    handleYieldValue,
    handleEndSend,
    handleInstrumentedEndSendA,
    handleCleanupThrow,
    handleSendA,
    handleResumeA,
    handleInstrumentedResumeA,
    handleGenStartA
};

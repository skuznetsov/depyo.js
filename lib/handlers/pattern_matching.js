const AST = require('../ast/ast_node');

/**
 * Pattern matching opcodes for match/case statements (Python 3.10+)
 */

function ensureMatchInitialized(subjectCandidate, options = {}) {
    const skipStackLookup = options.skipStackLookup || false;
    if (this.currentMatch) {
        return;
    }

    // Prefer subject from stack (TOS-1), fallback to provided candidate or saved potential
    const stackLen = this.dataStack ? this.dataStack.length : 0;
    let tosMinusOne = (!skipStackLookup && stackLen >= 2) ? this.dataStack[stackLen - 2] : null;
    this.matchSubject = subjectCandidate || tosMinusOne;

    if (!this.matchSubject && !skipStackLookup && this.dataStack && this.dataStack.length > 0) {
        this.matchSubject = this.dataStack.top();
    }

    if (!this.matchSubject && this.potentialMatchSubject) {
        this.matchSubject = this.potentialMatchSubject;
    }

    if (!this.matchSubject) {
        if (global.g_cliArgs?.debug) {
            console.log(`[MATCH] Unable to initialize match at offset ${this.code.Current.Offset}: no subject available (stackLen=${this.dataStack?.length || 0})`);
        }
        return;
    }

    this.currentMatch = new AST.ASTMatch(this.matchSubject);
    this.currentMatch.line = this.code.Current.LineNo;
    this.matchParentBlock = this.curBlock;
    this.inMatchPattern = true;
    this.patternOps = [];
    if (!this.matchPreNodesStart) {
        this.matchPreNodesStart = this.curBlock.nodes.length;
    }

    if (global.g_cliArgs?.debug) {
        console.log(`[MATCH] Initialized new ASTMatch at offset ${this.code.Current.Offset} subject=${this.matchSubject?.constructor?.name}`);
    }
}

function handleMatchSequence() {
    // MATCH_SEQUENCE opcode (Python 3.10+)
    // Tests if TOS is a sequence (tuple, list, etc.) but not str/bytes/bytearray
    // Stack: TOS = value (copy from COPY 1), TOS1 = subject
    // IMPORTANT: TOS is NOT popped! Result is pushed on top.

    if (!this.inMatchPattern && this.currentMatch) {
        this.inMatchPattern = true;
        this.patternOps = [];
    }

    let value = this.dataStack.top();  // Peek at the copy (don't pop!)

    if (global.g_cliArgs?.debug) {
        console.log(`[MATCH_SEQUENCE] at offset ${this.code.Current.Offset}`);
        console.log(`  currentMatch=${this.currentMatch ? 'active' : 'null'}`);
        console.log(`  Stack depth=${this.dataStack.length}`);
    }

    const subjectCandidate = this.dataStack && this.dataStack.length >= 2 ? this.dataStack[this.dataStack.length - 2] : null;
    ensureMatchInitialized.call(this, subjectCandidate);

    // Mark that we're in pattern checking phase
    this.inMatchPattern = true;
    this.patternOps = [];  // Clear pattern operations for new case

    // Record pattern operation
    this.patternOps.push({type: 'MATCH_SEQUENCE'});

    // Push True to indicate sequence check passed
    // (In reality, should check type, but for decompilation we assume it passes)
    let node = new AST.ASTObject(new (require('../PythonObject').PythonObject)("Py_Bool", true));
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleGetLen() {
    // GET_LEN opcode (Python 3.10+)
    // Pushes len(TOS) onto stack (TOS is not popped)
    // Used in sequence pattern matching to check length

    let value = this.dataStack.top();

    // Record pattern operation if in pattern matching
    if (this.inMatchPattern) {
        this.patternOps.push({type: 'GET_LEN'});
    }

    // Create len(value) call node
    // This will be compared with expected length in subsequent COMPARE_OP
    let lenNode = new AST.ASTCall(
        new AST.ASTName('len'),
        [value],
        []
    );
    lenNode.line = this.code.Current.LineNo;
    this.dataStack.push(lenNode);

    if (global.g_cliArgs?.debug) {
        console.log(`[GET_LEN] at offset ${this.code.Current.Offset}, value=${value?.constructor.name}`);
    }
}

function handleMatchMapping() {
    // MATCH_MAPPING opcode (Python 3.10+)
    // Similar to MATCH_SEQUENCE but for mappings (dicts)

    ensureMatchInitialized.call(this, null, {skipStackLookup: true});

    let value = this.dataStack.pop();
    if (this.inMatchPattern) {
        this.patternOps.push({type: 'MATCH_MAPPING'});
    }
    let node = new AST.ASTObject(new (require('../PythonObject').PythonObject)("Py_Bool", true));
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);

    if (global.g_cliArgs?.debug) {
        console.log(`[MATCH_MAPPING] Stub implementation at offset ${this.code.Current.Offset}`);
    }
}

function handleMatchClassA() {
    // MATCH_CLASS_A opcode (Python 3.10+)
    // Matches object against a class pattern

    let count = this.code.Current.Argument;

    ensureMatchInitialized.call(this, null, {skipStackLookup: true});

    if (!this.inMatchPattern && this.currentMatch) {
        this.inMatchPattern = true;
        this.patternOps = [];
    }

    // Pop class object and subject
    for (let i = 0; i < count + 1; i++) {
        this.dataStack.pop();
    }

    if (this.inMatchPattern) {
        this.patternOps.push({type: 'MATCH_CLASS', count});
    }

    // Push success placeholder
    let node = new AST.ASTObject(new (require('../PythonObject').PythonObject)("Py_Bool", true));
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);

    if (global.g_cliArgs?.debug) {
        console.log(`[MATCH_CLASS] Stub implementation at offset ${this.code.Current.Offset}, count=${count}, inMatch=${this.inMatchPattern}`);
    }
}

function handleMatchKeys() {
    // MATCH_KEYS opcode (Python 3.10+)
    // Used in mapping patterns

    ensureMatchInitialized.call(this, null, {skipStackLookup: true});

    this.dataStack.pop(); // keys tuple
    let subject = this.dataStack.top();
    if (this.inMatchPattern) {
        this.patternOps.push({type: 'MATCH_KEYS'});
    }

    // Push (values_tuple, True) or None
    let node = new AST.ASTTuple([]);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);

    if (global.g_cliArgs?.debug) {
        console.log(`[MATCH_KEYS] Stub implementation at offset ${this.code.Current.Offset}`);
    }
}

module.exports = {
    handleMatchSequence,
    handleGetLen,
    handleMatchMapping,
    handleMatchClassA,
    handleMatchKeys
};

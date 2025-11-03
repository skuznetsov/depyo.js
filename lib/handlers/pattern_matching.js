const AST = require('../ast/ast_node');

/**
 * Pattern matching opcodes for match/case statements (Python 3.10+)
 */

function handleMatchSequence() {
    // MATCH_SEQUENCE opcode (Python 3.10+)
    // Tests if TOS is a sequence (tuple, list, etc.) but not str/bytes/bytearray
    // Stack: TOS = value (copy from COPY 1), TOS1 = subject
    // IMPORTANT: TOS is NOT popped! Result is pushed on top.

    let value = this.dataStack.top();  // Peek at the copy (don't pop!)

    if (global.g_cliArgs?.debug) {
        console.log(`[MATCH_SEQUENCE] at offset ${this.code.Current.Offset}`);
        console.log(`  currentMatch=${this.currentMatch ? 'active' : 'null'}`);
        console.log(`  Stack depth=${this.dataStack.length}`);
    }

    // Check if we're starting a new match statement
    if (!this.currentMatch) {
        // The subject should be on the stack (was LOADed, then COPYed)
        // After COPY before MATCH_SEQUENCE: [subject, copy]
        // TOS = copy, TOS1 = subject
        this.matchSubject = this.dataStack[this.dataStack.length - 2];

        if (global.g_cliArgs?.debug) {
            console.log(`  Starting new match, subject=${this.matchSubject?.constructor.name}`);
        }

        // Create new ASTMatch node
        this.currentMatch = new AST.ASTMatch(this.matchSubject);
        this.currentMatch.line = this.code.Current.LineNo;

        // Save the current block - this is where the match should be appended when complete
        this.matchParentBlock = this.curBlock;

        if (global.g_cliArgs?.debug) {
            console.log(`  Created ASTMatch, will append to ${this.matchParentBlock?.type_str}(${this.matchParentBlock?.start}-${this.matchParentBlock?.end})`);
        }
    }

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

    let value = this.dataStack.pop();
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

    // Pop class object and subject
    for (let i = 0; i < count + 1; i++) {
        this.dataStack.pop();
    }

    // Push success placeholder
    let node = new AST.ASTObject(new (require('../PythonObject').PythonObject)("Py_Bool", true));
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);

    if (global.g_cliArgs?.debug) {
        console.log(`[MATCH_CLASS] Stub implementation at offset ${this.code.Current.Offset}, count=${count}`);
    }
}

function handleMatchKeys() {
    // MATCH_KEYS opcode (Python 3.10+)
    // Used in mapping patterns

    this.dataStack.pop(); // keys tuple
    let subject = this.dataStack.top();

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

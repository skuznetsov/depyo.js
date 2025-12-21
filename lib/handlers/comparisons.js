const AST = require('../ast/ast_node');

function handleCompareOpA() {
    // Literal-only match patterns in 3.13+: COPY 1 + LOAD_CONST + COMPARE_OP
    // No MATCH_* opcodes appear, so initialize match tracking here.
    // Match patterns only exist in Python 3.10+
    if (!this.currentMatch && this.potentialMatchSubject && !this.inMatchPattern &&
        this.object.Reader.versionCompare(3, 10) >= 0) {
        this.matchSubject = this.potentialMatchSubject;
        this.currentMatch = new AST.ASTMatch(this.matchSubject);
        this.currentMatch.line = this.code.Current.LineNo;
        this.matchParentBlock = this.curBlock;
        this.patternOps = [];
        if (!this.matchPreNodesStart && this.matchParentBlock) {
            this.matchPreNodesStart = this.matchParentBlock.nodes.length;
        }
    }
    if (this.currentMatch && !this.inMatchPattern) {
        this.inMatchPattern = true;
        this.patternOps = [];
    }
    const jumpOps = [
        this.OpCodes.POP_JUMP_IF_FALSE_A,
        this.OpCodes.POP_JUMP_FORWARD_IF_FALSE_A,
        this.OpCodes.POP_JUMP_IF_TRUE_A,
        this.OpCodes.POP_JUMP_FORWARD_IF_TRUE_A
    ];
    if (this.currentMatch && this.patternOps?.length && jumpOps.includes(this.code.Prev?.OpCodeID)) {
        this.patternOps = [];
    }

    let right = this.dataStack.pop();
    let left = this.dataStack.pop();
    let arg = this.code.Current.Argument;
    if (this.object.Reader.versionCompare(3, 13) >= 0) {
        // Python 3.13 encodes the comparison in packed form; map observed
        // specializations back to standard compare ops.
        const mapped = {
            18: AST.ASTCompare.CompareOp.Less,         // guards: n < 0
            72: AST.ASTCompare.CompareOp.Equal,        // len == N
            88: AST.ASTCompare.CompareOp.Equal,        // literal == value
            148: AST.ASTCompare.CompareOp.Greater      // guards: n > 0
        };
        arg = mapped[arg] ?? (arg & 0x0F);
    } else if (this.object.Reader.versionCompare(3, 12) >= 0) {
        // 3.12 quickened form stores compare op in high nibble
        arg >>= 4;
    }

    // Record pattern operation if in pattern matching
    if (this.inMatchPattern) {
        this.patternOps.push({
            type: 'COMPARE',
            op: arg,
            left: left,
            right: right
        });
    }

    // Debug: exception match (arg=10)
    if (arg == 10 && global.g_cliArgs?.debug) {
        console.log(`[COMPARE_OP] EXCEPTION MATCH at offset ${this.code.Current.Offset}`);
        console.log(`  left=${left?.constructor.name} ${left?.codeFragment?.() || left}`);
        console.log(`  right=${right?.constructor.name} ${right?.codeFragment?.() || right}`);
        console.log(`  Stack depth: ${this.dataStack.length}`);
    }

    let node = new AST.ASTCompare (left, right, arg);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleContainsOpA() {
    let right = this.dataStack.pop();
    let left = this.dataStack.pop();
    // The this.code.Current.Argument will be 0 for 'in' and 1 for 'not in'.
    let node = new AST.ASTCompare (left, right, this.code.Current.Argument ? AST.ASTCompare.CompareOp.NotIn : AST.ASTCompare.CompareOp.In);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleIsOpA() {
    let right = this.dataStack.pop();
    let left = this.dataStack.pop();
    // The this.code.Current.Argument will be 0 for 'is' and 1 for 'is not'.
    let node = new AST.ASTCompare (left, right, this.code.Current.Argument ? AST.ASTCompare.CompareOp.IsNot : AST.ASTCompare.CompareOp.Is);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

module.exports = {
    handleCompareOpA,
    handleContainsOpA,
    handleIsOpA
};

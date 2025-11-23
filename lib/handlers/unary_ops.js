const AST = require('../ast/ast_node');

function handleUnaryCall() {
    let funcNode = this.dataStack.pop();
    let node = new AST.ASTCall(funcNode, [], []);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleConvertValueA() {
    // Python 3.14 CONVERT_VALUE: runtime conversion helper, no AST change.
    if (global.g_cliArgs?.debug) {
        console.log(`[CONVERT_VALUE] arg=${this.code.Current.Argument} at offset ${this.code.Current.Offset}`);
    }
}

function handleUnaryConvert() {
    let name = this.dataStack.pop();
    let node = new AST.ASTConvert(name);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleUnaryInvert() {
    let arg = this.dataStack.pop();
    let node = new AST.ASTUnary(arg, AST.ASTUnary.UnaryOp.Invert);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);    
}

function handleUnaryNegative() {
    let arg = this.dataStack.pop();
    let node = new AST.ASTUnary(arg, AST.ASTUnary.UnaryOp.Negative);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);    
}

function handleUnaryNot() {
    let arg = this.dataStack.pop();
    let node = new AST.ASTUnary(arg, AST.ASTUnary.UnaryOp.Not);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);    
}

function handleUnaryPositive() {
    let arg = this.dataStack.pop();
    let node = new AST.ASTUnary(arg, AST.ASTUnary.UnaryOp.Positive);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);    
}

function handleToBool() {
    // Python 3.13+ TO_BOOL: normalize truthiness. Preserve stack value.
    const arg = this.dataStack.pop();
    this.dataStack.push(arg);
}


module.exports = {
    handleUnaryCall,
    handleConvertValueA,
    handleUnaryConvert,
    handleUnaryInvert,
    handleUnaryNegative,
    handleUnaryNot,
    handleUnaryPositive,
    handleToBool
};

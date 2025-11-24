const AST = require('../ast/ast_node');

function handleUnaryCall() {
    let funcNode = this.dataStack.pop();
    let node = new AST.ASTCall(funcNode, [], []);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleConvertValueA() {
    // Python 3.14 CONVERT_VALUE: capture requested conversion for upcoming FORMAT_*.
    const val = this.dataStack.pop();
    const flag = this.code.Current.Argument;
    let conversion = AST.ASTFormattedValue.ConversionFlag.None;

    if (flag === 1) {
        conversion = AST.ASTFormattedValue.ConversionFlag.Str;
    } else if (flag === 2) {
        conversion = AST.ASTFormattedValue.ConversionFlag.Repr;
    } else if (flag === 3) {
        conversion = AST.ASTFormattedValue.ConversionFlag.ASCII;
    }

    let node;
    if (val instanceof AST.ASTFormattedValue) {
        val.m_conversion = conversion;
        node = val;
    } else {
        node = new AST.ASTFormattedValue(val, conversion, null);
        node.line = this.code.Current.LineNo;
    }
    this.dataStack.push(node);
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

function handleExitInitCheck() {
    // Python 3.14 EXIT_INIT_CHECK: no-op for decompiler.
}


module.exports = {
    handleUnaryCall,
    handleConvertValueA,
    handleUnaryConvert,
    handleUnaryInvert,
    handleUnaryNegative,
    handleUnaryNot,
    handleUnaryPositive,
    handleToBool,
    handleExitInitCheck
};

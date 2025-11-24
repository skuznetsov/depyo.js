const AST = require('../ast/ast_node');

function handleBuildTemplate() {
    // Python 3.14 BUILD_TEMPLATE: template objects for f-strings; keep stack as-is (operands already handled by formatting ops).
    const count = this.code.Current.Argument || 0;
    const items = [];
    for (let i = 0; i < count; i++) {
        items.unshift(this.dataStack.pop());
    }
    // Re-push items as a tuple-like collection to preserve stack shape.
    const tpl = new AST.ASTTuple(items);
    tpl.requireParens = false;
    this.dataStack.push(tpl);
}

function handleBuildInterpolationA() {
    // Python 3.14 BUILD_INTERPOLATION: build f-string pieces (similar to BUILD_STRING).
    const count = this.code.Current.Argument || 0;
    const values = [];
    for (let i = 0; i < count; i++) {
        values.push(this.dataStack.pop());
    }
    const joined = new AST.ASTJoinedStr(values);
    joined.line = this.code.Current.LineNo;
    this.dataStack.push(joined);
}

module.exports = {
    handleBuildTemplate,
    handleBuildInterpolationA
};

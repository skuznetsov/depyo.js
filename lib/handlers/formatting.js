const AST = require('../ast/ast_node');

// PEP 750 t-strings (Python 3.14+):
//   strings_tuple ; (value ; str_repr ; [format_spec])+ ; BUILD_INTERPOLATION oparg
//   ... ; BUILD_TUPLE N ; BUILD_TEMPLATE -> Template
// BUILD_INTERPOLATION oparg layout:
//   oparg & 3        = pop count (2 = no format spec, 3 = has format spec)
//   (oparg >> 2) & 3 = conversion (0=none, 1=!s, 2=!r, 3=!a)
function handleBuildInterpolationA() {
    const oparg = this.code.Current.Argument || 0;
    const popCount = oparg & 3;
    const convCode = (oparg >> 2) & 3;

    let formatSpec = null;
    if (popCount === 3) {
        formatSpec = this.dataStack.pop();
    }
    this.dataStack.pop(); // discard str representation (used at runtime)
    const value = this.dataStack.pop();

    const conversion = convCode === 0 ? AST.ASTFormattedValue.ConversionFlag.None
                     : convCode === 1 ? AST.ASTFormattedValue.ConversionFlag.Str
                     : convCode === 2 ? AST.ASTFormattedValue.ConversionFlag.Repr
                     :                  AST.ASTFormattedValue.ConversionFlag.ASCII;

    const node = new AST.ASTFormattedValue(value, conversion, formatSpec);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleBuildTemplate() {
    // Pops (strings_tuple, interpolations_tuple) and produces a Template node.
    const interpolations = this.dataStack.pop();
    const strings = this.dataStack.pop();

    let interpVals = [];
    if (interpolations instanceof AST.ASTTuple) {
        interpVals = interpolations.values || [];
    } else if (interpolations?.object?.Value) {
        interpVals = interpolations.object.Value;
    }

    // strings is loaded via LOAD_CONST as a Py_Tuple of Py_String objects
    let stringVals = [];
    if (strings instanceof AST.ASTTuple) {
        stringVals = strings.values || [];
    } else if (strings?.object?.Value) {
        // Wrap each Py_String in an ASTObject so ASTJoinedStr.codeFragment can render it.
        stringVals = strings.object.Value.map(pyStr => new AST.ASTObject(pyStr));
    }

    // Interleave: str[0], interp[0], str[1], interp[1], ..., str[N]
    const pieces = [];
    for (let i = 0; i < stringVals.length; i++) {
        if (stringVals[i]) {
            pieces.push(stringVals[i]);
        }
        if (i < interpVals.length) {
            pieces.push(interpVals[i]);
        }
    }

    // ASTJoinedStr's codeFragment reverses (BUILD_STRING pops in reverse). Compensate.
    pieces.reverse();
    const joined = new AST.ASTJoinedStr(pieces);
    joined.isTemplateString = true;
    joined.line = this.code.Current.LineNo;
    this.dataStack.push(joined);
}

module.exports = {
    handleBuildTemplate,
    handleBuildInterpolationA
};

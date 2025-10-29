const PycObject = require('../PythonObject').PythonObject;
const AST = require('../ast/ast_node');

function handleUnpackListA() {
    processUnpack.call(this);
}

function handleUnpackTupleA() {
    processUnpack.call(this);
}

function handleUnpackSequenceA() {
    processUnpack.call(this);
}

function processUnpack() {
    this.unpack = this.code.Current.Argument;
    if (this.unpack > 0) {
        let node = new AST.ASTTuple([]);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);    
    } else {
        // Unpack zero values and assign it to top of stack or for loop variable.
        // E.g. [] = TOS / for [] in X
        let tupleNode = new AST.ASTTuple([]);
        if (this.curBlock.blockType == AST.ASTBlock.BlockType.For
            && !this.curBlock.inited) {
            tupleNode.requireParens = true;
            this.curBlock.index = tupleNode;
        } else if (this.dataStack.top() instanceof AST.ASTChainStore) {
            let chainStore = this.dataStack.pop();
            chainStore.line = this.code.Current.LineNo;
            this.append_to_chain_store(chainStore, tupleNode);
        } else {
            let node = new AST.ASTStore(this.dataStack.pop(), tupleNode);
            node.line = this.code.Current.LineNo;
            this.curBlock.append(node);
        }
    }
}

function handleUnpackArgA() {
    let data = this.dataStack.pop();
    this.object.ArgCount = this.code.Current.Argument;
    for (let idx = 0; idx < this.code.Current.Argument; idx++) {                                
        this.object.VarNames.Value.push(data[idx]);
    }
    this.code.GoNext(this.code.Current.Argument);
}

function handleUnpackExA() {
    this.unpack = (this.code.Current.Argument & 0xFF);
    this.starPos = this.unpack;
    this.unpack += 1 + (this.code.Current.Argument >> 8) & 0xFF;

    let source = this.dataStack.pop();
    let tuple = new AST.ASTTuple([]);
    tuple.requireParens = false;
    this.dataStack.push(new PycObject("Py_Null"));
    this.dataStack.push(new AST.ASTChainStore([], source));
    this.dataStack.push(tuple);
}

function handleBuildListUnpackA() {
    processBuild.call(this);
}

function handleBuildTupleUnpackA() {
    processBuild.call(this);
}

function handleBuildTupleUnpackWithCallA() {
    // Python 3.6+ - same as BUILD_TUPLE_UNPACK but with better error messages
    processBuild.call(this);
}

function processBuild() {
    let values = [];
    for (let idx = 0; idx < this.code.Current.Argument; idx++) {
        values.unshift(this.dataStack.pop());
    }
    let listNode = new AST.ASTList(values); // Or ASTTuple based on opcode
    this.dataStack.push(listNode);
}

function handleBuildSetUnpackA() {
    let values = [];
    for (let idx = 0; idx < this.code.Current.Argument; idx++) {
        values.unshift(this.dataStack.pop());
    }
    let setNode = new AST.ASTSet(values);
    this.dataStack.push(setNode);
}

function handleBuildMapUnpackA() {
    processBuildMapUnpack.call(this);
}

function handleBuildMapUnpackWithCallA() {
    processBuildMapUnpack.call(this);
}

function processBuildMapUnpack() {
    let mapNode = new AST.ASTMap();
    for (let idx = 0; idx < this.code.Current.Argument; idx++) {
        let pair = this.dataStack.pop(); // Should be a dictionary
        if (pair instanceof AST.ASTMap) {
            for (const entry of pair.values) {
                mapNode.add(entry.key, entry.value);
            }
        } else {
            console.error("Expected a map for BUILD_MAP_UNPACK");
        }
    }
    this.dataStack.push(mapNode);
}

module.exports = {
    handleUnpackListA,
    handleUnpackTupleA,
    handleUnpackSequenceA,
    handleUnpackArgA,
    handleUnpackExA,
    handleBuildListUnpackA,
    handleBuildTupleUnpackA,
    handleBuildTupleUnpackWithCallA,
    handleBuildSetUnpackA,
    handleBuildMapUnpackA,
    handleBuildMapUnpackWithCallA
};
const AST = require('../ast/ast_node');

function handleSetAdd() {
    this.handleSetAddA();
}

function handleSetAddA() {
    let setOffset = this.code.Current.OpCodeID == this.OpCodes.SET_ADD_A ? this.code.Current.Argument - 1 : 0;
    let setNode = this.dataStack.top(setOffset);
    let value = this.dataStack.pop();
    if (this.curBlock.blockType == AST.ASTBlock.BlockType.For && this.curBlock.comprehension) {
        this.dataStack.pop();
        let node = new AST.ASTComprehension (value);
        node.line = this.code.Current.LineNo;
        node.kind = AST.ASTComprehension.SET;
        this.dataStack.push(node);
    } else {
        setNode.add(value);
    }
}

function handleListAppend() {
    processListAppend.call(this);
}

function handleListAppendA() {
    processListAppend.call(this);
}

function processListAppend() {
    let value = this.dataStack.pop();
    let list = this.dataStack.top();

    if (this.curBlock.blockType == AST.ASTBlock.BlockType.For && this.curBlock.comprehension) {
        this.dataStack.pop();
        let node = new AST.ASTComprehension (value);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    } else {
        let node = new AST.ASTSubscr (list, value);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }
}

function handleSetUpdateA() {
    let rhs = this.dataStack.pop();
    let lhs = this.dataStack.pop();

    if (!(rhs instanceof AST.ASTObject)) {
        fprintf(stderr, "Unsupported argument found for SET_UPDATE\n");
        return;
    }

    // I've only ever seen this be a TYPE_FROZENSET, but let's be careful...
    let obj = rhs.object;
    if (obj?.ClassType != "Py_FrozenSet") {
        console.error("Unsupported argument type found for SET_UPDATE\n");
        return;
    }

    let result = lhs.values;
    for (let value of this.object.values) {
        result.push(new AST.ASTObject (value));
    }

    let node = new AST.ASTSet (result);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleListExtendA() {
    let rhs = this.dataStack.pop();
    let lhs = this.dataStack.pop();

    if (!(rhs instanceof AST.ASTObject)) {
        fprintf(stderr, "Unsupported argument found for LIST_EXTEND\n");
        return;
    }

    // I've only ever seen this be a SMALL_TUPLE, but let's be careful...
    let obj = rhs.object;
    if (this.object.ClassType != "Py_Tuple" && this.object.ClassType != "Py_SmallTuple") {
        console.error("Unsupported argument type found for LIST_EXTEND\n");
        return;
    }

    let result = lhs.values;
    for (let value of this.object.values) {
        result.push(new AST.ASTObject(value));
    }

    let node = new AST.ASTList (result);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleDictMergeA() {
    let dictToMerge = this.dataStack.pop();
    let targetDict = this.dataStack.top();
    if (targetDict instanceof AST.ASTMap && dictToMerge instanceof AST.ASTMap) {
        for (const entry of dictToMerge.values) {
            targetDict.add(entry.key, entry.value);
        }
    } else {
        console.error("Expected ASTMap for DICT_MERGE_A");
    }
}

function handleDictUpdateA() {
    let updateSource = this.dataStack.pop();
    let targetDict = this.dataStack.top();
    if (targetDict instanceof AST.ASTMap) {
        if (updateSource instanceof AST.ASTMap) {
            for (const entry of updateSource.values) {
                targetDict.add(entry.key, entry.value);
            }
        } else if (updateSource instanceof AST.ASTCall && updateSource.func instanceof AST.ASTName && updateSource.func.name == 'zip') {
            // Handle case where updateSource is a zip of keys and values
            if (updateSource.pparams.length === 2) {
                let keys = updateSource.pparams[0];
                let values = updateSource.pparams[1];
                if (keys instanceof AST.ASTList && values instanceof AST.ASTList && keys.values.length === values.values.length) {
                    for (let i = 0; i < keys.values.length; i++) {
                        targetDict.add(keys.values[i], values.values[i]);
                    }
                } else if (keys instanceof AST.ASTTuple && values instanceof AST.ASTTuple && keys.values.length === values.values.length) {
                    for (let i = 0; i < keys.values.length; i++) {
                        targetDict.add(keys.values[i], values.values[i]);
                    }
                } else {
                    console.error("Expected lists or tuples of equal length for zip in DICT_UPDATE_A");
                }
            }
        } else {
            // TODO: Handle iterable of key-value pairs
            console.error("Expected ASTMap or iterable for DICT_UPDATE_A");
        }
    } else {
        console.error("Expected ASTMap for DICT_UPDATE_A target");
    }
}

module.exports = {
    handleSetAdd,
    handleSetAddA,
    handleListAppend,
    handleListAppendA,
    handleSetUpdateA,
    handleListExtendA,
    handleDictMergeA,
    handleDictUpdateA
};
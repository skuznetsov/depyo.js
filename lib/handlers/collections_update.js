const AST = require('../ast/ast_node');

function handleSetAdd() {
    handleSetAddA.call(this);
}

function handleSetAddA() {
    let value = this.dataStack.pop();

    // Check if this is a set comprehension first
    if (this.curBlock.blockType == AST.ASTBlock.BlockType.For && this.curBlock.comprehension) {
        this.dataStack.pop(); // Pop the empty set
        let node = new AST.ASTComprehension(value);
        node.line = this.code.Current.LineNo;
        node.kind = AST.ASTComprehension.SET;
        this.dataStack.push(node);
        return;
    }

    // Normal set add
    let setOffset = this.code.Current.OpCodeID == this.OpCodes.SET_ADD_A ? this.code.Current.Argument - 1 : 0;
    let setNode = this.dataStack.top(setOffset);
    if (!setNode || typeof setNode.add !== 'function') {
        if (global.g_cliArgs?.debug) {
            console.error(`SET_ADD target missing or invalid at offset ${this.code.Current.Offset}`);
        }
        return;
    }
    setNode.add(value);
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
    const rhs = this.dataStack.pop();
    const lhs = this.dataStack.pop();

    const targetValues = lhs instanceof AST.ASTSet ? [...(lhs.values || [])] : [];
    const rhsValues = collectIterableValues(rhs);

    if (!rhsValues) {
        if (global.g_cliArgs?.debug) {
            console.error("Unsupported argument found for SET_UPDATE");
        }
        this.dataStack.push(lhs);
        return;
    }

    let node = new AST.ASTSet([...targetValues, ...rhsValues]);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleListExtendA() {
    const rhs = this.dataStack.pop();
    const lhs = this.dataStack.pop();

    if (!(lhs instanceof AST.ASTList)) {
        if (global.g_cliArgs?.debug) {
            console.error("LIST_EXTEND target is not a list literal");
        }
        this.dataStack.push(lhs);
        return;
    }

    const appendValues = collectIterableValues(rhs);

    if (!appendValues || appendValues.length === 0) {
        if (global.g_cliArgs?.debug) {
            console.error("Unsupported argument found for LIST_EXTEND");
        }
        this.dataStack.push(lhs);
        return;
    }

    lhs.values.push(...appendValues);

    this.dataStack.push(lhs);
}

function handleDictMergeA() {
    const dictToMerge = this.dataStack.pop();
    const targetDict = this.dataStack.top();
    const entries = collectMapEntries(dictToMerge);

    if (!(targetDict instanceof AST.ASTMap) || !entries) {
        if (global.g_cliArgs?.debug) {
            console.error("Expected ASTMap for DICT_MERGE_A");
        }
        return;
    }

    for (const entry of entries) {
        targetDict.add(entry.key, entry.value);
    }
}

function handleDictUpdateA() {
    const updateSource = this.dataStack.pop();
    const targetDict = this.dataStack.top();

    if (!(targetDict instanceof AST.ASTMap)) {
        if (global.g_cliArgs?.debug) {
            console.error("Expected ASTMap for DICT_UPDATE_A target");
        }
        return;
    }

    if (updateSource instanceof AST.ASTCall && updateSource.func instanceof AST.ASTName && updateSource.func.name == 'zip') {
        // Handle case where updateSource is a zip of keys and values
        if (updateSource.pparams.length === 2) {
            let keys = updateSource.pparams[0];
            let values = updateSource.pparams[1];
            if (keys instanceof AST.ASTList && values instanceof AST.ASTList && keys.values.length === values.values.length) {
                for (let i = 0; i < keys.values.length; i++) {
                    targetDict.add(keys.values[i], values.values[i]);
                }
                return;
            } else if (keys instanceof AST.ASTTuple && values instanceof AST.ASTTuple && keys.values.length === values.values.length) {
                for (let i = 0; i < keys.values.length; i++) {
                    targetDict.add(keys.values[i], values.values[i]);
                }
                return;
            } else if (global.g_cliArgs?.debug) {
                console.error("Expected lists or tuples of equal length for zip in DICT_UPDATE_A");
            }
        }
    }

    const entries = collectMapEntries(updateSource);
    if (!entries) {
        if (global.g_cliArgs?.debug) {
            console.error("Expected ASTMap or iterable for DICT_UPDATE_A");
        }
        return;
    }

    for (const entry of entries) {
        targetDict.add(entry.key, entry.value);
    }
}

function collectIterableValues(node) {
    if (node instanceof AST.ASTList || node instanceof AST.ASTTuple || node instanceof AST.ASTSet) {
        return node.values || [];
    }

    if (node instanceof AST.ASTObject) {
        const obj = node.object;
        if (["Py_List", "Py_Tuple", "Py_SmallTuple", "Py_Set", "Py_FrozenSet"].includes(obj?.ClassName)) {
            return (obj.Value || []).map(value => new AST.ASTObject(value));
        }
    }

    return null;
}

function collectMapEntries(node) {
    if (node instanceof AST.ASTMap || node instanceof AST.ASTKwNamesMap) {
        return node.values || [];
    }

    if (node instanceof AST.ASTConstMap) {
        let keysArray = [];
        if (node.keys instanceof AST.ASTObject) {
            const obj = node.keys.object;
            if (obj?.ClassName === 'Py_Tuple' || obj?.ClassName === 'Py_SmallTuple') {
                keysArray = (obj.Value || []).map(v => new AST.ASTObject(v));
            }
        } else if (Array.isArray(node.keys)) {
            keysArray = node.keys;
        }

        const valuesArray = Array.isArray(node.values) ? [...node.values].reverse() : [];
        const count = Math.min(keysArray.length, valuesArray.length);
        const entries = [];
        for (let i = 0; i < count; i++) {
            entries.push({key: keysArray[i], value: valuesArray[i]});
        }
        return entries.length ? entries : null;
    }

    if (node instanceof AST.ASTList || node instanceof AST.ASTTuple) {
        const entries = [];
        for (const pair of node.values || []) {
            if (pair instanceof AST.ASTTuple && pair.values?.length === 2) {
                entries.push({key: pair.values[0], value: pair.values[1]});
            }
        }
        if (entries.length) {
            return entries;
        }
    }

    if (node instanceof AST.ASTObject) {
        const obj = node.object;
        if (obj?.ClassName === "Py_Dict") {
            return (obj.Value || []).map(({key, value}) => ({
                key: new AST.ASTObject(key),
                value: new AST.ASTObject(value)
            }));
        }
    }

    return null;
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

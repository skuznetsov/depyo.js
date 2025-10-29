const fs = require('node:fs');
const path = require('node:path');
const AST = require('./ast/ast_node');

Array.prototype.top = function ArrayTop (pos = 0) {
    return this[this.length - pos - 1];
}

Array.prototype.empty = function ArrayIsEmpty () {
    return this.length == 0;
}

class PycDecompiler {
    static opCodeHandlers = {};
    cleanBuild = false;
    object = null;
    code = null;
    blocks = [];
    unpack = 0;
    starPos = -1;
    skipNextJump = false;
    else_pop = false;
    variable_annotations = null;
    need_try = null;
    defBlock = null;
    curBlock = null;
    dataStack = [];
    handlers = {};
    unreachableUntil = -1;  // Offset until which code is unreachable after break/continue/return

    constructor(obj) {
        if (obj == null) {
            return;
        }

        this.object = obj;
        this.OpCodes = this.object.Reader.OpCodes;
        this.code = new this.OpCodes(this.object);
        this.defBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Main, 0, this.code.LastOffset);
        this.defBlock.init();
        this.curBlock = this.defBlock;
        this.blocks.push(this.defBlock);

        if (Object.keys(PycDecompiler.opCodeHandlers).length == 0) {
            PycDecompiler.setupHandlers();
        }
        
    }

    static setupHandlers() {
        const handlersDir = path.join(__dirname, 'handlers');
        const OpCodesMap = require('./OpCodes');
    
        function processDirectory (dir) {
            let entries;
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch (err) {
                console.error(`Error reading handlers directory ${dir}:`, err);
                return;
            }

            for (const entry of entries) {
                if (entry.isFile() && entry.name.endsWith('.js')) {
                    const filePath = path.join(dir, entry.name);
                    try {
                        const fileExports = require(filePath);
                        for (const handlerName in fileExports) {
                            if (Object.hasOwnProperty.call(fileExports, handlerName) &&
                                typeof fileExports[handlerName] === 'function' &&
                                handlerName.startsWith("handle")) {
    
                                // Convert handler name (e.g., "handleJumpForwardA") to opcode name ("JUMP_FORWARD_A")
                                let opCodeName = handlerName.replace(/^handle/, '')
                                                .replaceAll(/([A-Z][a-z]+)/g, m => m.toUpperCase() + '_')
                                                .replace(/_$/, '');
    
                                if (opCodeName in OpCodesMap) {
                                    const opCodeId = OpCodesMap[opCodeName];
                                    const handlerFunc = fileExports[handlerName];
    
                                    if (PycDecompiler.opCodeHandlers[opCodeId]) {
                                         console.warn(`Static Handler warning: OpCode ${opCodeName} (${opCodeId}) already has a handler. Overwriting.`);
                                    }
                                    PycDecompiler.opCodeHandlers[opCodeId] = handlerFunc;
                                } else {
                                    console.warn(`Static Handler mapping warning: OpCode name "${opCodeName}" from ${entry.name} not found in OpCodes map.`);
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`Error loading static handlers from ${filePath}:`, err);
                    }
                }
            }
        };
    
        processDirectory(handlersDir);
    }
        
    decompile() {
        let functonBody = this.statements();

        if (this.object.Name != "<lambda>" && functonBody.last instanceof AST.ASTReturn && functonBody.last.value instanceof AST.ASTNone) {
            functonBody.list.pop();
        }

        if (functonBody.list.length == 0) {
            functonBody.list.push(new AST.ASTKeyword(AST.ASTKeyword.Word.Pass));
        }


        return functonBody;
    }

    append_to_chain_store(chainStore, item)
    {
        if (this.dataStack.top() == item) {
            this.dataStack.pop();    // ignore identical source object.
        }
        chainStore.append(item);
        if (this.dataStack.top()?.ClassName == "Py_Null") {
            this.curBlock.append(chainStore);
        } else {
            this.dataStack.push(chainStore);
        }
    }

    checkIfExpr()
    {
        if (this.dataStack.empty())
            return;
        if (this.curBlock.nodes.length < 2)
            return;
        let rit = this.curBlock.nodes[this.curBlock.nodes.length - 1];
        // the last is "else" block, the one before should be "if" (could be "for", ...)
        if (!(rit instanceof AST.ASTBlock) ||
            rit.blockType != AST.ASTBlock.BlockType.Else)
            return;
        rit = this.curBlock.nodes[this.curBlock.nodes.length - 2];
        if (!(rit instanceof AST.ASTBlock) ||
            rit.blockType != AST.ASTBlock.BlockType.If)
            return;
        let else_expr = this.dataStack.pop();
        this.curBlock.removeLast();
        let if_block = this.curBlock.nodes.top();
        let if_expr = this.dataStack.pop();
        if (if_expr == null && if_block.nodes.length == 1) {
            if_expr = if_block.nodes[0];
            if_block.nodes.length = 0;
        }
        this.curBlock.removeLast();
        this.dataStack.push(new AST.ASTTernary(if_block, if_expr, else_expr));
    }
    
    statements () {
        if (this.object == null) {
            return null;
        }

        // Track SETUP_FINALLY/SETUP_EXCEPT targets for exception handling
        this.exceptionHandlerOffsets = new Set();

        while (this.code.HasInstructionsToProcess) {
            try {
                this.code.GoNext();

                // Python 3.8: When entering exception handler, push exception instance to stack
                if (this.exceptionHandlerOffsets.has(this.code.Current.Offset)) {
                    // Create synthetic exception instance placeholder
                    let excInstance = new AST.ASTName('__exception__');
                    excInstance.line = this.code.Current.LineNo;
                    this.dataStack.push(excInstance);

                    if (global.g_cliArgs?.debug) {
                        console.log(`[ExceptionHandler] Pushed synthetic exception at offset ${this.code.Current.Offset}`);
                    }
                }

                if (g_cliArgs?.debug && g_cliArgs.verbose && (this.code.Current.InstructionName?.includes('JUMP') || this.code.Current.InstructionName?.includes('BREAK') || this.code.Current.InstructionName?.includes('LOOP') || this.code.Current.Offset < 30)) {
                    console.log(`[${this.code.Current.Offset}] ${this.code.Current.InstructionName} arg=${this.code.Current.Argument} target=${this.code.Current.JumpTarget || 'N/A'}`);
                }

                // Skip unreachable code after break/continue/return
                if (this.unreachableUntil > 0 && this.code.Current.Offset < this.unreachableUntil) {
                    if (g_cliArgs?.debug) {
                        console.log(`Skipping unreachable code at offset ${this.code.Current.Offset} (until ${this.unreachableUntil}): ${this.code.Current.InstructionName}`);
                    }
                    continue;
                }
                if (this.unreachableUntil > 0) {
                    if (g_cliArgs?.debug) {
                        console.log(`Exiting unreachable region at offset ${this.code.Current.Offset} (was until ${this.unreachableUntil})`);
                    }
                }
                this.unreachableUntil = -1;  // Reset when we pass the unreachable region

                if (this.need_try && this.code.Current.OpCodeID != this.OpCodes.SETUP_EXCEPT_A) {
                    this.need_try = false;
        
                    let tryBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Try, this.code.Current.Offset, this.curBlock.end, true);
                    this.blocks.push(tryBlock);
                    this.curBlock = this.blocks.top();
                } else if (
                    this.else_pop &&
                    ![
                        this.OpCodes.JUMP_FORWARD_A,
                        this.OpCodes.JUMP_IF_FALSE_A,
                        this.OpCodes.JUMP_IF_FALSE_OR_POP_A,
                        this.OpCodes.POP_JUMP_IF_FALSE_A,
                        this.OpCodes.POP_JUMP_FORWARD_IF_FALSE_A,
                        this.OpCodes.JUMP_IF_TRUE_A,
                        this.OpCodes.JUMP_IF_TRUE_OR_POP_A,
                        this.OpCodes.POP_JUMP_IF_TRUE_A,
                        this.OpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
                        this.OpCodes.POP_BLOCK
                    ].includes(this.code.Current.OpCodeID)
                ) {
                    this.else_pop = false;
        
                    let prev = this.curBlock;
                    while (prev.end < this.code.Next?.Offset && prev.blockType != AST.ASTBlock.BlockType.Main) {
                        if (prev.blockType != AST.ASTBlock.BlockType.Container) {
                            if (prev.end == 0) {
                                break;
                            }
                        }

                        if (g_cliArgs?.debug) {
                            console.log(`Closing block ${prev.type_str}(${prev.start}-${prev.end}) at offset ${this.code.Current.Offset} (Next=${this.code.Next?.Offset})`);
                        }

                        this.blocks.pop();

                        if (this.blocks.empty())
                            break;

                        this.curBlock = this.blocks.top();
                        this.curBlock.append(prev);

                        if (g_cliArgs?.debug) {
                            console.log(`  Appended to ${this.curBlock.type_str}(${this.curBlock.start}-${this.curBlock.end}), now has ${this.curBlock.nodes.length} nodes`);
                        }

                        prev = this.curBlock;

                        this.checkIfExpr();
                    }
                }
        
                if (this.code.Current.OpCodeID in PycDecompiler.opCodeHandlers)
                {
                    PycDecompiler.opCodeHandlers[this.code.Current.OpCodeID].call(this);
                } else {
                    console.error(`Unsupported opcode ${this.code.Current.InstructionName} at pos ${this.code.Current.Offset}\n`);
                    this.cleanBuild = false;
                    let node = new AST.ASTNodeList(this.defBlock.nodes);
                    return node;
                }
                this.else_pop = [AST.ASTBlock.BlockType.Else,
                            AST.ASTBlock.BlockType.If,
                            AST.ASTBlock.BlockType.Elif
                            ].includes(this.curBlock.blockType)
                        && (this.curBlock.end == this.code.Next?.Offset);

            } catch (ex) {
                console.error(`EXCEPTION for OpCode ${this.code.Current.InstructionName} (${this.code.Current.Argument}) at offset ${this.code.Current.Offset} in code object '${this.object.Name}', file offset ${this.object.codeOffset + this.code.Current.Offset} : ${ex.message}\n\n`);
                if (global.g_cliArgs?.debug) {
                    console.error('Stack trace:', ex.stack);
                }
            }
        }
    
        if (this.blocks.length > 1) {
            if (g_cliArgs?.debug) {
                console.error(`Warning: block stack is not empty${this.blocks.length} blocks.\n`);
                console.error('Remaining blocks in stack:');
                for (let i = 0; i < this.blocks.length; i++) {
                    let blk = this.blocks[i];
                    console.error(`  [${i}] ${blk.type_str} (${blk.start}-${blk.end}) nodes=${blk.nodes.length}`);
                }
            }

            while (this.blocks.length > 1) {
                let tmp = this.blocks.pop();

                // Set end offset for blocks that were never closed properly
                if (tmp.end === 0 || tmp.end === undefined) {
                    tmp.end = this.code.Current?.Offset || this.object.CodeSize;
                    if (g_cliArgs?.debug) {
                        console.error(`  Setting end=${tmp.end} for unclosed ${tmp.type_str}(${tmp.start}-${tmp.end})`);
                    }
                }

                if (g_cliArgs?.debug) {
                    console.error(`Appending ${tmp.type_str} (nodes=${tmp.nodes.length}) to ${this.blocks.top().type_str}`);
                }
                this.blocks.top().append(tmp);
            }
        }
    
        this.cleanBuild = true;
        let mainNode = new AST.ASTNodeList(this.defBlock.nodes);
        return mainNode;
    }

    /**
     * Recursively checks if a block ends with a terminating keyword (break/continue/return)
     * Used to prevent generating additional continue statements after breaks in nested blocks
     */
    hasTerminatingKeyword(block) {
        if (!block || !block.nodes || block.nodes.length == 0) {
            return false;
        }

        let lastNode = block.nodes[block.nodes.length - 1];

        // Check if last node is a terminating keyword
        if (lastNode instanceof AST.ASTKeyword) {
            return [AST.ASTKeyword.Word.Break,
                    AST.ASTKeyword.Word.Continue,
                    AST.ASTKeyword.Word.Return].includes(lastNode.word);
        }

        // Check if last node is a block - recurse into it
        if (lastNode instanceof AST.ASTBlock) {
            return this.hasTerminatingKeyword(lastNode);
        }

        // Check if last node is a return statement
        if (lastNode instanceof AST.ASTReturn) {
            return true;
        }

        return false;
    }
}

module.exports = PycDecompiler;

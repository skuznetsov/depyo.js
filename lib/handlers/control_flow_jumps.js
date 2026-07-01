const AST = require('../ast/ast_node');

// Resolve the actual jump target of a conditional/forward jump, mirroring the
// adjustments processJumpOps applies inline: 3.10+ doubles the argument
// (BPO-27129), and 3.12+ (plus the explicitly-forward pop-jumps from 3.11)
// is relative to the next instruction's offset. Several 3.13+ pop-jumps lack
// the HasJumpRelative/Absolute flags, so OpCode.JumpTarget returns 0 for
// them — callers must use this helper instead of reading JumpTarget directly.
const _RJTOpCodes = require('../OpCodes');

// 3.11+ inline caches are emitted by the reader as standalone instructions
// (OpCodes.CACHE / opcode 0) sitting between the real ones. The decompiler
// doesn't dispatch them, but anything that walks Instructions[] by index
// needs to skip them or any pattern-match around a "real" prior/next opcode
// breaks on 3.11+.
function prevNonCacheIdx(instructions, startIdx, OpCodes) {
    let i = startIdx;
    while (i >= 0) {
        const instr = instructions[i];
        if (!instr) return -1;
        if (instr.OpCodeID !== OpCodes.CACHE) return i;
        i--;
    }
    return -1;
}
function nextNonCacheIdx(instructions, startIdx, OpCodes) {
    let i = startIdx;
    while (i < instructions.length) {
        const instr = instructions[i];
        if (!instr) return -1;
        if (instr.OpCodeID !== OpCodes.CACHE) return i;
        i++;
    }
    return -1;
}

function resolveJumpTarget(instr, reader, nextOffset, instructions, instrIdx) {
    if (!instr || !reader) return 0;
    // Mirror processJumpOps' arithmetic so chain detection sees the same
    // target the if-block path would compute. We can't reuse OpCode.JumpTarget
    // because (a) it doesn't apply BPO-27129 doubling on 3.10+ and (b) some
    // 3.12+ pop-jumps land with HasJumpRelative/Absolute unset and return 0.
    let offs = instr.Argument || 0;
    if (reader.versionCompare(3, 10) >= 0) offs *= 2; // BPO-27129
    const RELATIVE_OPS = new Set([
        // JUMP_IF_FALSE/TRUE_A: relative on Py1.x-3.0 (where they exist).
        _RJTOpCodes.JUMP_IF_FALSE_A, _RJTOpCodes.JUMP_IF_TRUE_A,
        // 3.11 split out forward variants; all relative.
        _RJTOpCodes.POP_JUMP_FORWARD_IF_FALSE_A, _RJTOpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
        _RJTOpCodes.POP_JUMP_FORWARD_IF_NONE_A, _RJTOpCodes.POP_JUMP_FORWARD_IF_NOT_NONE_A,
        // 3.12+ unified pop-jumps that lack flags in opcode tables.
        _RJTOpCodes.POP_JUMP_IF_NONE_A, _RJTOpCodes.POP_JUMP_IF_NOT_NONE_A,
        _RJTOpCodes.INSTRUMENTED_POP_JUMP_IF_NONE_A, _RJTOpCodes.INSTRUMENTED_POP_JUMP_IF_NOT_NONE_A
    ].filter(v => v !== undefined));
    // 3.11 made JUMP_IF_FALSE/TRUE_OR_POP relative; they were absolute on 2.7-3.10.
    const orPopRelativeOn311 = reader.versionCompare(3, 11) >= 0 &&
        reader.versionCompare(3, 12) < 0 && (
            instr.OpCodeID === _RJTOpCodes.JUMP_IF_FALSE_OR_POP_A ||
            instr.OpCodeID === _RJTOpCodes.JUMP_IF_TRUE_OR_POP_A
        );
    const isRelative = reader.versionCompare(3, 12) >= 0 ||
        RELATIVE_OPS.has(instr.OpCodeID) ||
        orPopRelativeOn311;
    if (isRelative) {
        // 3.11+ inline caches are emitted by our reader as standalone CACHE
        // instructions, but CPython jumps as if they were appended to the
        // preceding "real" instruction. Use the offset of the next non-CACHE
        // entry so targets land on real opcodes, matching the offsets the
        // boolChainStack frames are compared against.
        let base;
        if (instructions && typeof instrIdx === 'number' && reader.versionCompare(3, 11) >= 0) {
            const nextRealIdx = nextNonCacheIdx(instructions, instrIdx + 1, _RJTOpCodes);
            base = nextRealIdx >= 0
                ? instructions[nextRealIdx].Offset
                : (nextOffset !== undefined ? nextOffset : (instr.Offset + (instr.Size || 2)));
        } else {
            base = nextOffset !== undefined ? nextOffset : (instr.Offset + (instr.Size || 2));
        }
        offs += base;
    }
    return offs;
}

function isInsideLoop(blocks) {
    return blocks.some(b => [AST.ASTBlock.BlockType.While, AST.ASTBlock.BlockType.For, AST.ASTBlock.BlockType.AsyncFor].includes(b.blockType));
}

function findBackwardJump(code, startIndex, currentOffset, backJumpOpcodes) {
    const instructions = code.Instructions || [];
    const maxLookahead = 100;
    for (let i = startIndex + 1; i < instructions.length && i <= startIndex + maxLookahead; i++) {
        const instr = instructions[i];
        if (!instr) {
            break;
        }
        if (backJumpOpcodes.includes(instr.OpCodeID) && instr.JumpTarget <= currentOffset) {
            return instr;
        }
        // Bail out once we are well past the current conditional to avoid accidental matches.
        if (instr.Offset - currentOffset > 300) {
            break;
        }
    }
    return null;
}

// 3.10-3.13 compile `while C: B` with a DUPLICATED condition:
//
//     <C>; POP_JUMP_IF_FALSE exit      # top entry guard (this instruction)
//   body:
//     <B>
//     <C copy>                          # bottom re-check (duplicate of C)
//     POP_JUMP_IF_TRUE body             # 3.10: conditional loop-back
//     / POP_JUMP_BACKWARD_IF_TRUE body  # 3.11
//     / POP_JUMP_IF_FALSE exit; JUMP_BACKWARD body   # 3.12/3.13
//   exit:
//
// The loop-back targets the body, not the condition, and the bottom condition is
// a verbatim copy of the top, so depyo's back-jump detector either misses it
// (3.11 conditional back-jump) or leaks the copy as `if C: pass` (3.12/3.13).
// Recognise the shape: open a While over the top condition, and register the
// dead [bottom-condition, exit) range so the duplicate + loop-back are skipped.
function tryStartDuplicatedConditionWhile(exitOffset, normalizedEnd) {
    const OpCodes = this.OpCodes;
    const reader = this.object?.Reader;
    if (!reader || reader.versionCompare(3, 10) < 0 || reader.versionCompare(3, 14) >= 0) return false;
    const instrs = this.code.Instructions || [];
    const guardIdx = this.code.CurrentInstructionIndex;

    const isNoise = (op) => [OpCodes.CACHE, OpCodes.NOT_TAKEN, OpCodes.INSTRUMENTED_NOT_TAKEN_A].includes(op);
    const backN = (fromIdx, n) => { // n-th non-noise index at or before fromIdx (returns [idx] walking back)
        let i = fromIdx, c = 0;
        while (i >= 0) {
            if (instrs[i] && !isNoise(instrs[i].OpCodeID)) { c++; if (c === n) return i; }
            i--;
        }
        return -1;
    };

    const bodyStartIdx = nextNonCacheIdx(instrs, guardIdx + 1, OpCodes);
    // skip NOT_TAKEN too
    let bIdx = bodyStartIdx;
    while (bIdx >= 0 && instrs[bIdx] && isNoise(instrs[bIdx].OpCodeID)) bIdx = nextNonCacheIdx(instrs, bIdx + 1, OpCodes);
    if (bIdx < 0) return false;
    const bodyStartOffset = instrs[bIdx].Offset;

    // A conditional loop-back can test either polarity: `while X` re-tests with
    // IF_TRUE -> body, `while not X` with IF_FALSE -> body. Both are loop-backs
    // (they target the body start); the condition-duplication check below is what
    // guards against misfiring on an unrelated conditional jump.
    const condLoopBack = [OpCodes.POP_JUMP_IF_TRUE_A, OpCodes.POP_JUMP_IF_FALSE_A,
                          OpCodes.POP_JUMP_BACKWARD_IF_TRUE_A, OpCodes.POP_JUMP_BACKWARD_IF_FALSE_A,
                          OpCodes.POP_JUMP_FORWARD_IF_TRUE_A, OpCodes.POP_JUMP_FORWARD_IF_FALSE_A,
                          OpCodes.INSTRUMENTED_POP_JUMP_IF_TRUE_A, OpCodes.INSTRUMENTED_POP_JUMP_IF_FALSE_A]
                         .filter(v => v !== undefined);
    const uncondLoopBack = [OpCodes.JUMP_BACKWARD_A, OpCodes.JUMP_BACKWARD_NO_INTERRUPT_A, OpCodes.JUMP_ABSOLUTE_A]
                           .filter(v => v !== undefined);
    const backwardOps = [OpCodes.JUMP_BACKWARD_A, OpCodes.JUMP_BACKWARD_NO_INTERRUPT_A,
                         OpCodes.POP_JUMP_BACKWARD_IF_TRUE_A, OpCodes.POP_JUMP_BACKWARD_IF_FALSE_A]
                        .filter(v => v !== undefined);

    // Resolve a loop-back jump's target. resolveJumpTarget() only *adds* the
    // delta, so it cannot resolve the backward jumps CPython uses for the
    // loop-back (3.11 POP_JUMP_BACKWARD_IF_*, 3.12/3.13 JUMP_BACKWARD). Handle
    // absolute (3.10 POP_JUMP_IF_TRUE / JUMP_ABSOLUTE) and backward-relative here.
    const resolveLoopBackTarget = (ins, idx) => {
        let arg = ins.Argument || 0;
        if (reader.versionCompare(3, 10) >= 0) arg *= 2; // BPO-27129 wordcode doubling
        if (backwardOps.includes(ins.OpCodeID)) {
            const nextRealIdx = nextNonCacheIdx(instrs, idx + 1, OpCodes);
            const base = nextRealIdx >= 0 ? instrs[nextRealIdx].Offset : (ins.Offset + (ins.Size || 2));
            return base - arg;
        }
        // 3.10 POP_JUMP_IF_TRUE / JUMP_ABSOLUTE are absolute: target = arg (already *2).
        return arg;
    };

    // Find the loop-back: a (conditional or unconditional) jump inside the body
    // window whose resolved target is the body start.
    let loopBackIdx = -1, loopBackCond = false;
    for (let i = bIdx; i < instrs.length; i++) {
        const ins = instrs[i];
        if (!ins || ins.Offset >= exitOffset) break;
        const isC = condLoopBack.includes(ins.OpCodeID);
        const isU = uncondLoopBack.includes(ins.OpCodeID);
        if (!isC && !isU) continue;
        const tgt = resolveLoopBackTarget(ins, i);
        if (tgt === bodyStartOffset) { loopBackIdx = i; loopBackCond = isC; break; }
    }
    if (loopBackIdx < 0) return false;

    // The bottom condition's final jump is the loop-back itself when it is
    // conditional, else the non-noise instruction right before the unconditional
    // JUMP_BACKWARD (a POP_JUMP_IF_FALSE -> exit that mirrors the top guard).
    const consumerIdx = loopBackCond ? loopBackIdx : backN(loopBackIdx - 1, 1);
    if (consumerIdx < 0) return false;

    // The loop condition is a run of value-producing ops (LOAD/COMPARE/CALL/...)
    // ending in the guard jump. Value ops naturally delimit the condition:
    // STORE_*/INPLACE_*/block ops are NOT value ops, so the walk-back stops at the
    // body/pre-loop boundary and never bleeds into surrounding code. (A byte-match
    // that ignores this can over-match when pre-loop code shares a suffix with the
    // body tail, e.g. `i = 0` before a loop ending in `i += 1`.) Compound
    // conditions (`a and b`) whose top is not folded upstream fall through to the
    // existing detector; this handles the common single-expression `while`.
    const condValueOps = new Set([
        OpCodes.LOAD_NAME_A, OpCodes.LOAD_FAST_A, OpCodes.LOAD_CONST_A, OpCodes.LOAD_GLOBAL_A,
        OpCodes.LOAD_ATTR_A, OpCodes.LOAD_DEREF_A, OpCodes.LOAD_CLASSDEREF_A, OpCodes.LOAD_METHOD_A,
        OpCodes.LOAD_FAST_CHECK_A, OpCodes.LOAD_FAST_AND_CLEAR_A, OpCodes.LOAD_FAST_LOAD_FAST_A,
        OpCodes.LOAD_FAST_BORROW_A, OpCodes.LOAD_SMALL_INT_A, OpCodes.LOAD_LOCALS,
        OpCodes.COMPARE_OP_A, OpCodes.COMPARE_OP, OpCodes.IS_OP_A, OpCodes.CONTAINS_OP_A,
        OpCodes.BINARY_OP_A, OpCodes.BINARY_OP, OpCodes.BINARY_SUBSCR, OpCodes.BINARY_SUBSCR_A,
        OpCodes.UNARY_NOT, OpCodes.UNARY_NEGATIVE, OpCodes.UNARY_POSITIVE, OpCodes.UNARY_INVERT,
        OpCodes.TO_BOOL, OpCodes.DUP_TOP, OpCodes.DUP_TOP_A, OpCodes.ROT_TWO, OpCodes.ROT_THREE,
        OpCodes.SWAP_A, OpCodes.COPY_A, OpCodes.LOAD_ATTR, OpCodes.CALL_A, OpCodes.CALL_FUNCTION_A,
        OpCodes.KW_NAMES_A, OpCodes.PUSH_NULL, OpCodes.LOAD_METHOD
    ].filter(v => v !== undefined));
    let condCount = 0, ci = guardIdx - 1;
    while (ci >= 0) {
        const op = instrs[ci]?.OpCodeID;
        if (op === undefined) break;
        if (isNoise(op)) { ci--; continue; }
        if (!condValueOps.has(op)) break;
        condCount++; ci--;
    }
    if (condCount === 0) return false;
    const topCondStartIdx = ci + 1;

    // The bottom condition is `condCount` value ops ending just before the
    // consumer. Require it to be a verbatim opcode copy of the top condition so
    // this never misfires on an unrelated backward jump.
    const bottomCondStartIdx = backN(consumerIdx - 1, condCount);
    if (bottomCondStartIdx < 0 || bottomCondStartIdx <= bIdx) return false;
    // Compare the two condition runs opcode-for-opcode (non-noise).
    const runOps = (startIdx, count) => {
        const ops = []; let i = startIdx;
        while (i < instrs.length && ops.length < count) {
            if (instrs[i] && !isNoise(instrs[i].OpCodeID)) ops.push(instrs[i].OpCodeID);
            i++;
        }
        return ops;
    };
    const topOps = runOps(topCondStartIdx, condCount);
    const botOps = runOps(bottomCondStartIdx, condCount);
    if (topOps.length !== condCount || botOps.length !== condCount) return false;
    for (let k = 0; k < condCount; k++) if (topOps[k] !== botOps[k]) return false;

    const bottomCondOffset = instrs[bottomCondStartIdx].Offset;
    if (!(bottomCondOffset > bodyStartOffset && bottomCondOffset < exitOffset)) return false;

    // Open the While over the top condition; body is [bodyStart, bottomCond);
    // the duplicate condition + loop-back [bottomCond, exit) is dead.
    const whileBlk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.While, bodyStartOffset, bottomCondOffset, null, false);
    whileBlk.line = this.code.Current.LineNo;
    this.blocks.push(whileBlk);
    this.curBlock = whileBlk;
    (this.chainDeadRegions ||= []).push({ from: bottomCondOffset, to: exitOffset });
    return true;
}

// Detect a Py2.x (or early-Py3) boolean expression chain rooted at the current
// JUMP_IF_* instruction. An expression chain converges at a value consumer
// (STORE_*, RETURN_*, COMPARE_OP, BINARY_*, UNARY_*, CALL_*, POP_JUMP_IF_*,
// another JUMP_IF_* for nested chains) without crossing block-level opcodes.
// This distinguishes `a = b and c or d` (expression, consumer=STORE_NAME) from
// `if b: pass; if c: pass` (control flow, two separate If blocks).
function isBoolExprChain(ctx) {
    const OpCodes = ctx.OpCodes;
    const reader = ctx.object?.Reader;
    const chainJumpOps = new Set([
        OpCodes.JUMP_IF_FALSE_A,
        OpCodes.JUMP_IF_TRUE_A,
        OpCodes.JUMP_IF_FALSE_OR_POP_A,
        OpCodes.JUMP_IF_TRUE_OR_POP_A,
        // 3.12+ short-circuit shape uses POP_JUMP_IF_FALSE/TRUE with a COPY 1
        // prefix. The lookahead accepts these unconditionally — the caller
        // (tryStartBoolChain) already validates the COPY 1 prefix on the start
        // instruction, and inner chain jumps will also be COPY-prefixed in any
        // genuine `a and b and c` expression. `if a and b: pass` (no COPY) is
        // a separate control-flow shape and never enters this function.
        OpCodes.POP_JUMP_IF_FALSE_A, OpCodes.POP_JUMP_IF_TRUE_A,
        OpCodes.POP_JUMP_FORWARD_IF_FALSE_A, OpCodes.POP_JUMP_FORWARD_IF_TRUE_A
    ].filter(v => v !== undefined));
    const valueOps = new Set([
        OpCodes.LOAD_NAME_A, OpCodes.LOAD_FAST_A, OpCodes.LOAD_CONST_A,
        OpCodes.LOAD_GLOBAL_A, OpCodes.LOAD_ATTR_A, OpCodes.LOAD_DEREF_A,
        OpCodes.LOAD_CLASSDEREF_A, OpCodes.LOAD_CLOSURE_A,
        OpCodes.LOAD_FAST_CHECK_A, OpCodes.LOAD_FAST_AND_CLEAR_A,
        OpCodes.LOAD_FAST_LOAD_FAST_A,
        OpCodes.LOAD_LOCALS, OpCodes.LOAD_BUILD_CLASS,
        OpCodes.POP_TOP, OpCodes.POP_TOP_A,
        OpCodes.DUP_TOP, OpCodes.DUP_TOP_A, OpCodes.ROT_TWO, OpCodes.ROT_THREE, OpCodes.ROT_FOUR,
        OpCodes.COPY_A, OpCodes.SWAP_A,
        OpCodes.COMPARE_OP, OpCodes.COMPARE_OP_A,
        OpCodes.UNARY_POSITIVE, OpCodes.UNARY_NEGATIVE, OpCodes.UNARY_NOT, OpCodes.UNARY_INVERT, OpCodes.UNARY_CONVERT,
        OpCodes.BINARY_ADD, OpCodes.BINARY_SUBTRACT, OpCodes.BINARY_MULTIPLY, OpCodes.BINARY_DIVIDE,
        OpCodes.BINARY_TRUE_DIVIDE, OpCodes.BINARY_FLOOR_DIVIDE, OpCodes.BINARY_MODULO, OpCodes.BINARY_POWER,
        OpCodes.BINARY_LSHIFT, OpCodes.BINARY_RSHIFT, OpCodes.BINARY_AND, OpCodes.BINARY_OR, OpCodes.BINARY_XOR,
        OpCodes.BINARY_SUBSCR, OpCodes.BINARY_SUBSCR_A,
        OpCodes.BINARY_OP_A, OpCodes.BINARY_OP,
        OpCodes.BINARY_MATRIX_MULTIPLY,
        OpCodes.IS_OP_A, OpCodes.CONTAINS_OP_A,
        // 3.13+ inserts TO_BOOL between COPY 1 and the pop-jump; 3.14 inserts
        // NOT_TAKEN immediately after the jump. Both are stack-preserving from
        // the decompiler's view, so they belong with value-level ops here.
        OpCodes.TO_BOOL, OpCodes.NOT_TAKEN, OpCodes.INSTRUMENTED_NOT_TAKEN_A,
        // 3.11+ CACHE entries sit interleaved between real opcodes; they
        // affect nothing semantically but must not break chain detection.
        OpCodes.CACHE
    ].filter(v => v !== undefined));
    const consumerOps = new Set([
        OpCodes.STORE_NAME_A, OpCodes.STORE_FAST_A, OpCodes.STORE_GLOBAL_A,
        OpCodes.STORE_DEREF_A, OpCodes.STORE_ATTR_A,
        OpCodes.STORE_SUBSCR, OpCodes.STORE_SUBSCR_A,
        OpCodes.RETURN_VALUE, OpCodes.RETURN_VALUE_A, OpCodes.RETURN_CONST_A,
        OpCodes.POP_JUMP_IF_FALSE_A, OpCodes.POP_JUMP_IF_TRUE_A,
        OpCodes.POP_JUMP_FORWARD_IF_FALSE_A, OpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
        OpCodes.POP_JUMP_FORWARD_IF_NONE_A, OpCodes.POP_JUMP_FORWARD_IF_NOT_NONE_A,
        OpCodes.POP_JUMP_BACKWARD_IF_NONE_A, OpCodes.POP_JUMP_BACKWARD_IF_NOT_NONE_A,
        OpCodes.POP_JUMP_IF_NONE_A, OpCodes.POP_JUMP_IF_NOT_NONE_A,
        OpCodes.CALL_FUNCTION_A, OpCodes.CALL_FUNCTION_KW_A, OpCodes.CALL_FUNCTION_EX_A,
        OpCodes.CALL_A, OpCodes.CALL_KW_A, OpCodes.CALL_METHOD_A,
        OpCodes.PRINT_ITEM, OpCodes.PRINT_ITEM_TO, OpCodes.PRINT_EXPR
    ].filter(v => v !== undefined));

    const startIdx = ctx.code.CurrentInstructionIndex;
    const instructions = ctx.code.Instructions || [];
    if (!instructions[startIdx] || !chainJumpOps.has(instructions[startIdx].OpCodeID)) return false;

    const startNext = instructions[startIdx + 1];
    let maxTarget = resolveJumpTarget(instructions[startIdx], reader, startNext?.Offset, instructions, startIdx);
    if (!maxTarget || maxTarget <= instructions[startIdx].Offset) return false;

    const maxLookahead = 64;
    for (let i = startIdx + 1; i < instructions.length && i - startIdx <= maxLookahead; i++) {
        const instr = instructions[i];
        if (!instr) return false;
        // Reached convergence offset — inspect what's there
        if (instr.Offset >= maxTarget) {
            // Another JUMP_IF_* at the convergence → nested chain continuation
            if (chainJumpOps.has(instr.OpCodeID)) return true;
            if (consumerOps.has(instr.OpCodeID)) return true;
            // POP_TOP at convergence = control flow cleanup (if-body), not expression.
            // Excluding this keeps `if X and Y: pass` — which always ends at POP_TOP —
            // on the existing if-merge path and lets frame synthesis fire only when
            // the chain value is actually consumed (STORE_*, RETURN_*, CALL_*, etc.).
            if (instr.OpCodeID === OpCodes.POP_TOP || instr.OpCodeID === OpCodes.POP_TOP_A) return false;
            // Any value op at the convergence means expression continues
            // (e.g. chain is sub-expression of a larger one)
            if (valueOps.has(instr.OpCodeID)) return true;
            return false;
        }
        // Extend the chain by further JUMP_IF_* targets
        if (chainJumpOps.has(instr.OpCodeID)) {
            const innerNext = instructions[i + 1];
            const innerTarget = resolveJumpTarget(instr, reader, innerNext?.Offset, instructions, i);
            if (innerTarget > maxTarget) {
                maxTarget = innerTarget;
            }
            continue;
        }
        // Only value-level opcodes allowed inside the chain window
        if (!valueOps.has(instr.OpCodeID)) return false;
    }
    return false;
}

// Frame-based reconstruction of Py2.x (and early-Py3) boolean expression chains.
// A chain of `LOAD + JUMP_IF_FALSE/TRUE + POP_TOP` pairs converging at a value
// consumer (STORE/RETURN/CALL/...) is the bytecode shape of `a = b and c or d`
// style expressions. The `isBoolExprChain` detector gates this; here we grow a
// per-decompiler stack of frames {target, op, lhs} and fold them into a
// compound AST.ASTBinary when execution reaches each frame's target offset.
//
// JUMP_IF_FALSE + POP_TOP => AND (lhs short-circuits when falsy).
// JUMP_IF_TRUE  + POP_TOP => OR  (lhs short-circuits when truthy).
function resolveBoolChainFrames(ctx, atOffset) {
    if (!ctx.boolChainStack || ctx.boolChainStack.length === 0) return;
    while (ctx.boolChainStack.length > 0) {
        const frame = ctx.boolChainStack[ctx.boolChainStack.length - 1];
        if (frame.target > atOffset) break;
        ctx.boolChainStack.pop();
        if (ctx.dataStack.length === 0) {
            // Stack underflow means we misread the chain; drop remaining frames
            // so we don't synthesize garbage and let normal handling resume.
            ctx.boolChainStack = [];
            return;
        }
        const rhs = ctx.dataStack.pop();
        const op = frame.op === 'AND'
            ? AST.ASTBinary.BinOp.LogicalAnd
            : AST.ASTBinary.BinOp.LogicalOr;
        const combined = new AST.ASTBinary(frame.lhs, rhs, op);
        combined.line = ctx.code.Current?.LineNo ?? 0;
        ctx.dataStack.push(combined);
    }
}

function tryStartBoolChain(ctx) {
    const OpCodes = ctx.OpCodes;
    if (ctx.inMatchPattern) return false;
    if (ctx.dataStack.length === 0) return false;

    const cur = ctx.code.Current;
    const curOp = cur.OpCodeID;

    // Three bytecode shapes for short-circuit boolean expressions:
    //   peek  — Py2.x / early-Py3: JUMP_IF_FALSE/TRUE_A + POP_TOP fall-through.
    //   orpop — 3.10/3.11: JUMP_IF_FALSE/TRUE_OR_POP_A pops on fall-through itself.
    //   copy  — 3.12+: LOAD; COPY 1; [TO_BOOL;] POP_JUMP_IF_FALSE/TRUE; [NOT_TAKEN;] POP_TOP; ...
    //           The COPY+POP_JUMP pair short-circuits like _OR_POP but uses
    //           generic pop-jumps. We disambiguate from `if a and b: pass`
    //           (which uses POP_JUMP without a preceding COPY) by requiring
    //           COPY 1 (with optional TO_BOOL between) immediately before the jump.
    const peekJumps = [OpCodes.JUMP_IF_FALSE_A, OpCodes.JUMP_IF_TRUE_A]
        .filter(v => v !== undefined);
    const orPopJumps = [OpCodes.JUMP_IF_FALSE_OR_POP_A, OpCodes.JUMP_IF_TRUE_OR_POP_A]
        .filter(v => v !== undefined);
    const popJumps = [
        OpCodes.POP_JUMP_IF_FALSE_A, OpCodes.POP_JUMP_IF_TRUE_A,
        OpCodes.POP_JUMP_FORWARD_IF_FALSE_A, OpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
        OpCodes.INSTRUMENTED_POP_JUMP_IF_FALSE_A, OpCodes.INSTRUMENTED_POP_JUMP_IF_TRUE_A
    ].filter(v => v !== undefined);

    const reader = ctx.object?.Reader;
    let mode = null;
    if (peekJumps.includes(curOp)) {
        mode = 'peek';
    } else if (orPopJumps.includes(curOp) && reader && reader.versionCompare(3, 10) >= 0) {
        // Pre-3.10 _OR_POP is already reconstructed by the existing AND/OR
        // merge path (see processJumpOps body). Intercepting it there causes
        // double-wrapping / wrong precedence in 2.7-3.9 fixtures. From 3.10
        // onward the bytecode shape stopped producing a separate POP_TOP for
        // the chain consumer, so the merge path no longer fires — that's
        // when we need to step in.
        mode = 'orpop';
    } else if (popJumps.includes(curOp)) {
        const instructions = ctx.code.Instructions || [];
        const curIdx = ctx.code.CurrentInstructionIndex;
        // 3.11+ wedges CACHE entries between TO_BOOL/COPY and the pop-jump.
        // Walk backward past them to land on the semantic predecessor(s).
        const prevIdx = prevNonCacheIdx(instructions, curIdx - 1, OpCodes);
        if (prevIdx < 0) return false;
        const prev = instructions[prevIdx];
        let copyInstr = prev;
        if (prev.OpCodeID === OpCodes.TO_BOOL) {
            const copyIdx = prevNonCacheIdx(instructions, prevIdx - 1, OpCodes);
            if (copyIdx < 0) return false;
            copyInstr = instructions[copyIdx];
        }
        if (copyInstr.OpCodeID !== OpCodes.COPY_A || copyInstr.Argument !== 1) {
            return false;
        }
        if (ctx.dataStack.length < 2) return false;
        mode = 'copy';
    } else {
        return false;
    }

    if (!isBoolExprChain(ctx)) return false;

    const instructionsAll = ctx.code.Instructions || [];
    const curIdxAll = ctx.code.CurrentInstructionIndex;
    const rawTarget = mode === 'peek'
        ? cur.JumpTarget
        : resolveJumpTarget(cur, ctx.object.Reader, ctx.code.Next?.Offset, instructionsAll, curIdxAll);
    if (!rawTarget || rawTarget <= cur.Offset) return false;

    const isFalseJump =
        curOp === OpCodes.JUMP_IF_FALSE_A ||
        curOp === OpCodes.JUMP_IF_FALSE_OR_POP_A ||
        curOp === OpCodes.POP_JUMP_IF_FALSE_A ||
        curOp === OpCodes.POP_JUMP_FORWARD_IF_FALSE_A ||
        curOp === OpCodes.INSTRUMENTED_POP_JUMP_IF_FALSE_A;

    // Peek/copy-shape optimization: the outer JUMP may target a shared POP_TOP
    // (Py2.4+) or stay there explicitly on 3.14 (POP_TOP after NOT_TAKEN). In
    // that case we must re-aim so the outer frame resolves BEFORE the inner
    // pop-jump consumes the stack — otherwise inner runs first and we get the
    // wrong precedence (e.g. `b and (c or d)` instead of `(b and c) or d`).
    let target = rawTarget;
    const instructions = ctx.code.Instructions || [];
    const curIdx = ctx.code.CurrentInstructionIndex;
    const peekChainOps = new Set([
        OpCodes.JUMP_IF_FALSE_A, OpCodes.JUMP_IF_TRUE_A
    ].filter(v => v !== undefined));
    const popOps = new Set([OpCodes.POP_TOP, OpCodes.POP_TOP_A].filter(v => v !== undefined));
    const rawTargetIdx = instructions.findIndex(i => i && i.Offset === rawTarget);
    if (rawTargetIdx > curIdx + 1 &&
        popOps.has(instructions[rawTargetIdx]?.OpCodeID)) {
        for (let i = rawTargetIdx - 1; i > curIdx; i--) {
            const instr = instructions[i];
            if (!instr) break;
            if (mode === 'peek' && peekChainOps.has(instr.OpCodeID) &&
                instr.JumpTarget >= rawTarget) {
                target = instr.Offset;
                break;
            }
            if (mode === 'copy' && popJumps.includes(instr.OpCodeID)) {
                const innerNext = instructions[i + 1];
                const innerTarget = resolveJumpTarget(instr, ctx.object.Reader,
                                                     innerNext?.Offset, instructions, i);
                if (innerTarget < rawTarget) break;
                // Walk back through the inner pop-jump's prefix (CACHE/TO_BOOL)
                // to its COPY 1; aim the outer at COPY 1 so the outer resolves
                // with the inner's rhs already on stack and pre-duplication.
                let j = prevNonCacheIdx(instructions, i - 1, OpCodes);
                if (j < 0) break;
                if (instructions[j].OpCodeID === OpCodes.TO_BOOL) {
                    j = prevNonCacheIdx(instructions, j - 1, OpCodes);
                    if (j < 0) break;
                }
                if (instructions[j].OpCodeID === OpCodes.COPY_A &&
                    instructions[j].Argument === 1) {
                    target = instructions[j].Offset;
                }
                break;
            }
        }
    }

    let lhs;
    if (mode === 'copy') {
        ctx.dataStack.pop();
        lhs = ctx.dataStack.pop();
    } else {
        lhs = ctx.dataStack.pop();
    }
    ctx.boolChainStack = ctx.boolChainStack || [];
    ctx.boolChainStack.push({ target, op: isFalseJump ? 'AND' : 'OR', lhs });

    if (mode === 'peek' || mode === 'copy') {
        // 3.11+ has CACHE entries trailing the pop-jump and the POP_TOP. 3.14
        // also inserts NOT_TAKEN between them. Advance past whichever sit
        // between us and the POP_TOP that pops the duplicated value.
        const advancePast = (predicate) => {
            const instructions = ctx.code.Instructions || [];
            const targetIdx = nextNonCacheIdx(instructions, ctx.code.CurrentInstructionIndex + 1, OpCodes);
            if (targetIdx < 0) return false;
            const instr = instructions[targetIdx];
            if (!predicate(instr)) return false;
            ctx.code.GoNext(targetIdx - ctx.code.CurrentInstructionIndex);
            return true;
        };
        advancePast(i => i.OpCodeID === OpCodes.NOT_TAKEN ||
                        i.OpCodeID === OpCodes.INSTRUMENTED_NOT_TAKEN_A);
        advancePast(i => i.OpCodeID === OpCodes.POP_TOP ||
                        i.OpCodeID === OpCodes.POP_TOP_A);
    }
    return true;
}

function tryStartConditionalExpression(ctx, cond, falseOffset) {
    if (!cond || falseOffset <= ctx.code.Current.Offset) {
        return false;
    }
    const falseIdx = ctx.code.GetIndexByOffset(falseOffset);
    if (falseIdx < 0) {
        return false;
    }

    // Statement terminators inside the true-branch: if the branch ends with a
    // side-effecting instruction (STORE_*, POP_TOP, RETURN, RAISE) before the
    // candidate JUMP_FORWARD, this is an if/else, not a ternary, and we must
    // not push a pending — that would suppress the real If block.
    const storeOps = new Set([
        ctx.OpCodes.STORE_FAST_A,
        ctx.OpCodes.STORE_NAME_A,
        ctx.OpCodes.STORE_GLOBAL_A,
        ctx.OpCodes.STORE_DEREF_A,
        ctx.OpCodes.STORE_ATTR_A,
        ctx.OpCodes.STORE_SUBSCR,
        ctx.OpCodes.STORE_SUBSCR_A,
        ctx.OpCodes.POP_TOP,
        ctx.OpCodes.POP_TOP_A,
        ctx.OpCodes.RETURN_VALUE,
        ctx.OpCodes.RETURN_VALUE_A,
        ctx.OpCodes.RETURN_CONST_A,
        ctx.OpCodes.RAISE_VARARGS_A,
    ].filter(v => v !== undefined));
    const blockOpeners = new Set([
        ctx.OpCodes.SETUP_EXCEPT_A,
        ctx.OpCodes.SETUP_FINALLY_A,
        ctx.OpCodes.SETUP_LOOP_A,
        ctx.OpCodes.SETUP_WITH_A,
        ctx.OpCodes.SETUP_ASYNC_WITH_A,
        ctx.OpCodes.FOR_ITER_A,
    ].filter(v => v !== undefined));

    let joinInstr = null, joinIdx = -1;
    for (let i = ctx.code.CurrentInstructionIndex + 1; i < falseIdx; i++) {
        const instr = ctx.code.Instructions[i];
        if (!instr) {
            continue;
        }
        // Crossing a block opener disqualifies: the JUMP_FORWARD inside the
        // nested block is not the true-branch's join.
        if (blockOpeners.has(instr.OpCodeID)) {
            return false;
        }
        if ([ctx.OpCodes.JUMP_FORWARD_A, ctx.OpCodes.JUMP_ABSOLUTE_A].includes(instr.OpCodeID)) {
            // Look at the instruction immediately before the jump. For a ternary,
            // it should leave a value on the stack (LOAD_*, BUILD_*, arithmetic),
            // not be a statement terminator.
            const prev = ctx.code.Instructions[i - 1];
            if (prev && storeOps.has(prev.OpCodeID)) {
                return false;
            }
            const target = instr.JumpTarget ?? -1;
            if (target > falseOffset && target <= falseOffset + 50) {
                joinInstr = instr;
                joinIdx = i;
                break;
            }
        }
    }

    if (!joinInstr) {
        return false;
    }

    // Inside a loop, `if cond: break` compiles to POP_JUMP -> loop-back plus a
    // JUMP_FORWARD that escapes the loop, which looks exactly like a ternary's
    // (false-jump, join-jump) pair. A real ternary keeps both targets *inside*
    // the loop body; if the false path or the join escapes to/past the loop end,
    // this is break/continue control flow, not a value join.
    // joinInstr.JumpTarget is not reliable for relative forward jumps on 3.11+
    // (it omits the cache-adjusted base). Resolve the real join target locally:
    // JUMP_FORWARD is relative-forward on all versions; JUMP_ABSOLUTE is absolute.
    const resolvedJoin = (() => {
        const reader = ctx.object?.Reader;
        let arg = joinInstr.Argument || 0;
        if (reader && reader.versionCompare(3, 10) >= 0) arg *= 2;
        if (joinInstr.OpCodeID === ctx.OpCodes.JUMP_ABSOLUTE_A) return arg;
        const instrs = ctx.code.Instructions;
        let j = joinIdx + 1;
        while (j < instrs.length && instrs[j] && instrs[j].OpCodeID === ctx.OpCodes.CACHE) j++;
        const base = (j < instrs.length && instrs[j]) ? instrs[j].Offset
                   : (joinInstr.Offset + (joinInstr.Size || 2));
        return base + arg;
    })();
    for (let bi = ctx.blocks.length - 1; bi >= 0; bi--) {
        const b = ctx.blocks[bi];
        if (![AST.ASTBlock.BlockType.While, AST.ASTBlock.BlockType.For,
              AST.ASTBlock.BlockType.AsyncFor].includes(b.blockType)) continue;
        if (b.end > 0 && (falseOffset >= b.end || resolvedJoin >= b.end)) {
            return false;
        }
        break; // only the innermost enclosing loop matters
    }

    ctx.pendingConditionalExprs ||= [];
    ctx.pendingConditionalExprs.push({
        cond,
        falseOffset,
        joinOffset: joinInstr.JumpTarget,
        trueValue: null,
        startOffset: ctx.code.Current.Offset
    });
    return true;
}

function captureTrueBranchForConditional(ctx) {
    if (!ctx.pendingConditionalExprs?.length) {
        return false;
    }
    const target = ctx.code.Current.JumpTarget;
    const pending = ctx.pendingConditionalExprs.find(p => p.joinOffset === target);
    if (!pending) {
        return false;
    }
    // A real ternary leaves the true-branch expression on the data stack; if
    // the stack is empty, this JUMP_FORWARD belongs to some other structure
    // (e.g. a nested try/except whose exit jump happens to land on the same
    // offset) and we must not consume it.
    if (!ctx.dataStack.length) {
        return false;
    }
    // Block openers between pending.startOffset and here mean the JUMP_FORWARD
    // is inside a nested scope and cannot be the ternary's true branch.
    const blockOpeners = new Set([
        ctx.OpCodes.SETUP_EXCEPT_A,
        ctx.OpCodes.SETUP_FINALLY_A,
        ctx.OpCodes.SETUP_LOOP_A,
        ctx.OpCodes.SETUP_WITH_A,
        ctx.OpCodes.SETUP_ASYNC_WITH_A,
        ctx.OpCodes.FOR_ITER_A,
    ].filter(v => v !== undefined));
    const startIdx = ctx.code.GetIndexByOffset(pending.startOffset);
    const curIdx = ctx.code.CurrentInstructionIndex;
    if (startIdx >= 0) {
        for (let i = startIdx + 1; i < curIdx; i++) {
            const instr = ctx.code.Instructions[i];
            if (instr && blockOpeners.has(instr.OpCodeID)) {
                return false;
            }
        }
    }
    pending.trueValue = ctx.dataStack.pop();
    return true;
}

function handleJumpIfFalseA() {
    processJumpOps.call(this);
}

function handleJumpIfTrueA() {
    processJumpOps.call(this);
}

function handleJumpIfFalseOrPopA() {
    processJumpOps.call(this);
}

function handleJumpIfTrueOrPopA() {
    processJumpOps.call(this);
}

function handlePopJumpIfFalseA() {
    processJumpOps.call(this);
}

function handlePopJumpIfTrueA() {
    processJumpOps.call(this);
}

function handlePopJumpForwardIfFalseA() {
    processJumpOps.call(this);
}

function handlePopJumpForwardIfTrueA() {
    processJumpOps.call(this);
}

function handlePopJumpForwardIfNoneA() {
    processJumpOps.call(this);
}

function handlePopJumpForwardIfNotNoneA() {
    processJumpOps.call(this);
}

function handlePopJumpBackwardIfNoneA() {
    processJumpOps.call(this);
}

function handlePopJumpBackwardIfNotNoneA() {
    processJumpOps.call(this);
}

function handlePopJumpIfNoneA() {
    processJumpOps.call(this);
}

function handlePopJumpIfNotNoneA() {
    processJumpOps.call(this);
}

function handleInstrumentedPopJumpIfFalseA() {
    processJumpOps.call(this);
}

function handleInstrumentedPopJumpIfTrueA() {
    processJumpOps.call(this);
}

function handleInstrumentedPopJumpIfNoneA() {
    processJumpOps.call(this);
}

function handleInstrumentedPopJumpIfNotNoneA() {
    processJumpOps.call(this);
}

function processJumpOps() {
    if (this.skipNextJump) {
        this.skipNextJump = false;
        // skipNextJump is only ever armed by the chained-compare fold, so this
        // jump is a chain's short-circuit. Record its target: it is where the
        // compiler duplicated the block tail (POP_TOP + a copy of the body) on
        // 3.10-3.12. consumeChainedCompareEpilogue uses it to drop that dead
        // region for inline (raise/return) chain-guard bodies.
        this.chainSkipTarget = resolveJumpTarget(
            this.code.Current, this.object?.Reader, this.code.Next?.Offset,
            this.code.Instructions || [], this.code.CurrentInstructionIndex);
        if (this.code.Next?.OpCodeID == this.OpCodes.POP_TOP) {
            this.code.GoNext();
        }
        return;
    }

    // Intercept boolean expression chains (a = b and c or d style) before the
    // If-block machinery. If this JUMP_IF_* is part of a chain converging at a
    // value consumer, push a frame and let resolveBoolChainFrames fold the
    // combined expression back onto dataStack when the chain's target offset
    // is reached. See comments on tryStartBoolChain / resolveBoolChainFrames.
    if (tryStartBoolChain(this)) {
        return;
    }

    const wrapNoneComparison = (expectNone) => {
        let value = this.dataStack.pop();
        let cmp = new AST.ASTCompare(
            value,
            new AST.ASTNone(),
            expectNone ? AST.ASTCompare.CompareOp.Is : AST.ASTCompare.CompareOp.IsNot
        );
        cmp.line = this.code.Current.LineNo;
        this.dataStack.push(cmp);
    };

    const jumpIfNotNoneOpcodes = [
        this.OpCodes.POP_JUMP_FORWARD_IF_NOT_NONE_A,
        this.OpCodes.POP_JUMP_BACKWARD_IF_NOT_NONE_A,
        this.OpCodes.POP_JUMP_IF_NOT_NONE_A,
        this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NOT_NONE_A
    ];

    const jumpIfNoneOpcodes = [
        this.OpCodes.POP_JUMP_FORWARD_IF_NONE_A,
        this.OpCodes.POP_JUMP_BACKWARD_IF_NONE_A,
        this.OpCodes.POP_JUMP_IF_NONE_A,
        this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NONE_A
    ];

    if (jumpIfNoneOpcodes.includes(this.code.Current.OpCodeID)) {
        wrapNoneComparison(true);
    } else if (jumpIfNotNoneOpcodes.includes(this.code.Current.OpCodeID)) {
        wrapNoneComparison(false);
    }

    if (this.inMatchPattern) {
        this.debug(`[processJumpOps] Inside match statement - tracking pattern instead of creating if block`);

        if ([
            this.OpCodes.POP_JUMP_IF_FALSE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_FALSE_A,
            this.OpCodes.POP_JUMP_IF_TRUE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_NONE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_NOT_NONE_A,
            this.OpCodes.POP_JUMP_BACKWARD_IF_NONE_A,
            this.OpCodes.POP_JUMP_BACKWARD_IF_NOT_NONE_A,
            this.OpCodes.POP_JUMP_IF_NONE_A,
            this.OpCodes.POP_JUMP_IF_NOT_NONE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_FALSE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_TRUE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NONE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NOT_NONE_A
        ].includes(this.code.Current.OpCodeID)) {
            this.dataStack.pop();
        }

        return;
    }

    // CRITICAL: Close blocks that have ended before creating new conditional block
    // This ensures proper sibling relationships between if/elif blocks.
    //
    // Exception: a Py2.x boolean expression chain (`a = b and c or d`) compiles
    // to a sequence of JUMP_IF_FALSE/JUMP_IF_TRUE + POP_TOP pairs converging at
    // a consumer (STORE/RETURN/CALL/etc). The first JUMP_IF_* opens an empty
    // If(end=T) block; when we reach offset T we find another JUMP_IF_* that
    // should continue the chain via the AND/OR merge below (line ~540). If we
    // close here, the merge opportunity is lost and the expression renders as
    // stray `if X: pass` control flow.
    const chainJumpOps = [
        this.OpCodes.JUMP_IF_FALSE_A,
        this.OpCodes.JUMP_IF_TRUE_A,
        this.OpCodes.JUMP_IF_FALSE_OR_POP_A,
        this.OpCodes.JUMP_IF_TRUE_OR_POP_A
    ].filter(v => v !== undefined);
    const keepOpenForChain = chainJumpOps.includes(this.code.Current.OpCodeID) &&
        this.curBlock.size === 0 &&
        this.curBlock.end === this.code.Current.Offset &&
        [AST.ASTBlock.BlockType.If, AST.ASTBlock.BlockType.Elif, AST.ASTBlock.BlockType.While].includes(this.curBlock.blockType) &&
        isBoolExprChain(this);

    while (!keepOpenForChain &&
           this.curBlock.end > 0 &&
           this.curBlock.end <= this.code.Current.Offset &&
           this.curBlock.blockType != AST.ASTBlock.BlockType.Main &&
           this.blocks.length > 1) {

        if (global.g_cliArgs?.debug) {
            console.log(`[processJumpOps] Closing ended block ${this.curBlock.type_str}(${this.curBlock.start}-${this.curBlock.end}) at offset ${this.code.Current.Offset}`);
        }

        let closedBlock = this.blocks.pop();
        this.curBlock = this.blocks.top();
        this.curBlock.append(closedBlock);

        if (global.g_cliArgs?.debug) {
            console.log(`  → Appended to ${this.curBlock.type_str}(${this.curBlock.start}-${this.curBlock.end}), now has ${this.curBlock.nodes.length} nodes`);
        }
    }

    if (this.ignoreNextConditional) {
        this.ignoreNextConditional = false;
        const baseDepth = this.cleanupStackDepth || this.dataStack.length;
        while (this.dataStack.length >= baseDepth) {
            this.dataStack.pop();
        }
        this.cleanupStackDepth = null;
        return;
    }

    let cond = this.dataStack.top();
    let ifblk = null;
    let popped = AST.ASTCondBlock.InitCondition.Uninited;

    if ([
            this.OpCodes.POP_JUMP_IF_FALSE_A,
            this.OpCodes.POP_JUMP_IF_TRUE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_FALSE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_NONE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_NOT_NONE_A,
            this.OpCodes.POP_JUMP_BACKWARD_IF_NONE_A,
            this.OpCodes.POP_JUMP_BACKWARD_IF_NOT_NONE_A,
            this.OpCodes.POP_JUMP_IF_NONE_A,
            this.OpCodes.POP_JUMP_IF_NOT_NONE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_FALSE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_TRUE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NONE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NOT_NONE_A
        ].includes(this.code.Current.OpCodeID)) {

        /* Pop condition before the jump */
        this.dataStack.pop();
        popped = AST.ASTCondBlock.InitCondition.PrePopped;
    } else if ([
        this.OpCodes.JUMP_IF_FALSE_OR_POP_A,
        this.OpCodes.JUMP_IF_TRUE_OR_POP_A,
        this.OpCodes.JUMP_IF_FALSE_A,
        this.OpCodes.JUMP_IF_TRUE_A
    ].includes(this.code.Current.OpCodeID)) {
        /* Pop condition only if condition is met */
        this.dataStack.pop();
        popped = AST.ASTCondBlock.InitCondition.Popped;
    }

    /* "Jump if true" means "Jump if not false" */
    let neg =  [
        this.OpCodes.JUMP_IF_TRUE_A, this.OpCodes.JUMP_IF_TRUE_OR_POP_A,
        this.OpCodes.POP_JUMP_IF_TRUE_A, this.OpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
        this.OpCodes.POP_JUMP_BACKWARD_IF_TRUE_A, this.OpCodes.INSTRUMENTED_POP_JUMP_IF_TRUE_A
    ].includes(this.code.Current.OpCodeID);

    let offs = this.code.Current.Argument;
    if (this.object.Reader.versionCompare(3, 10) >= 0)
        offs *= 2; // // BPO-27129
    if (this.object.Reader.versionCompare(3, 12) >= 0
        || [
            this.OpCodes.JUMP_IF_FALSE_A, this.OpCodes.JUMP_IF_TRUE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_TRUE_A, this.OpCodes.POP_JUMP_FORWARD_IF_FALSE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_NONE_A, this.OpCodes.POP_JUMP_FORWARD_IF_NOT_NONE_A,
            this.OpCodes.POP_JUMP_IF_NONE_A, this.OpCodes.POP_JUMP_IF_NOT_NONE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NONE_A, this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NOT_NONE_A
        ].includes(this.code.Current.OpCodeID)) {
        /* Offset is relative in these cases. 3.11+ emits CACHE pseudo-instructions
         * after some jumps; CPython measures the relative target from the next
         * *real* instruction, so skip CACHE entries when choosing the base.
         * 3.13/3.14 put a cache after POP_JUMP_IF_*, which otherwise shortens the
         * if-block by 2 bytes and hoists a single-statement body (raise/return)
         * out of the block as a `pass` + dangling statement. */
        let base = this.code.Next?.Offset;
        if (this.object.Reader.versionCompare(3, 11) >= 0) {
            const instrs = this.code.Instructions || [];
            const ni = nextNonCacheIdx(instrs, this.code.CurrentInstructionIndex + 1, this.OpCodes);
            if (ni >= 0) base = instrs[ni].Offset;
        }
        offs += base ?? 0;
    }

    const rawJumpTarget = offs; // target before block end normalization
    [offs] = this.code.FindEndOfBlock(offs);

    const condJumpOpcodes = new Set([
        this.OpCodes.POP_JUMP_IF_FALSE_A,
        this.OpCodes.POP_JUMP_IF_TRUE_A,
        this.OpCodes.POP_JUMP_FORWARD_IF_FALSE_A,
        this.OpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
        this.OpCodes.POP_JUMP_FORWARD_IF_NONE_A,
        this.OpCodes.POP_JUMP_FORWARD_IF_NOT_NONE_A,
        this.OpCodes.POP_JUMP_BACKWARD_IF_NONE_A,
        this.OpCodes.POP_JUMP_BACKWARD_IF_NOT_NONE_A,
        this.OpCodes.POP_JUMP_IF_NONE_A,
        this.OpCodes.POP_JUMP_IF_NOT_NONE_A,
        this.OpCodes.INSTRUMENTED_POP_JUMP_IF_FALSE_A,
        this.OpCodes.INSTRUMENTED_POP_JUMP_IF_TRUE_A,
        this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NONE_A,
        this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NOT_NONE_A
    ]);
    const backJumpOpcodes = [
        this.OpCodes.JUMP_ABSOLUTE_A,
        this.OpCodes.JUMP_BACKWARD_A,
        this.OpCodes.JUMP_BACKWARD_NO_INTERRUPT_A
    ];

    // Python 3.8+ while-loops no longer emit SETUP_LOOP; detect via backward jumps.
    if (!this.inMatchPattern &&
        condJumpOpcodes.has(this.code.Current.OpCodeID) &&
        !isInsideLoop(this.blocks)) {
        // 3.10-3.13 compile `while C: B` as a top entry-guard (`C; POP_JUMP_IF_FALSE
        // exit`) + body + a DUPLICATED condition + a loop-back to the body start.
        // Try that shape first; it needs the duplicate bottom condition dropped.
        const dupWhile = tryStartDuplicatedConditionWhile.call(this, rawJumpTarget, offs);
        if (!dupWhile) {
            const backJump = findBackwardJump(this.code, this.code.CurrentInstructionIndex, this.code.Current.Offset, backJumpOpcodes);
            // Treat as a while-loop only when the body extends past the backward jump target.
            if (backJump && offs > backJump.Offset) {
                const loopStart = backJump.JumpTarget;
                const whileBlk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.While, loopStart, offs, null, false);
                whileBlk.line = this.code.Current.LineNo;
                this.blocks.push(whileBlk);
                this.curBlock = whileBlk;
            }
        }
    }

    const isEgMatchCall = cond instanceof AST.ASTCall &&
        cond.func instanceof AST.ASTName &&
        cond.func.name === "__check_eg_match__";
    const isExceptCompare = cond instanceof AST.ASTCompare &&
        cond.op == AST.ASTCompare.CompareOp.Exception;

    // Conditional expression (a if cond else b) heuristic:
    // POP_JUMP_IF_* to falseOffset, then JUMP_FORWARD to joinOffset > falseOffset.
    // Skip for exception matches: except handlers emit a similar bytecode shape
    // (POP_JUMP_IF_FALSE past handler body, JUMP_FORWARD over END_FINALLY) but
    // are not ternary expressions and must not be rewritten.
    if (!this.inMatchPattern &&
        !isExceptCompare && !isEgMatchCall &&
        condJumpOpcodes.has(this.code.Current.OpCodeID) &&
        tryStartConditionalExpression(this, cond, rawJumpTarget)) {
        return;
    }

    if ([   this.OpCodes.JUMP_IF_FALSE_A,
            this.OpCodes.JUMP_IF_TRUE_A
        ].includes(this.code.Current.OpCodeID) &&
        this.code.Next?.OpCodeID == this.OpCodes.POP_TOP
    ) {
        this.code.GoNext();
    }

    if (global.g_cliArgs?.debug) {
        console.log(`\nConditional jump at offset ${this.code.Current.Offset}: curBlock=${this.curBlock.type_str} (type=${this.curBlock.blockType}), size=${this.curBlock.size}, inited=${this.curBlock.inited}`);
        if (this.curBlock.size > 0) {
            console.log(`  Block nodes:`, this.curBlock.nodes.map(n => `${n.constructor.name}`));
        }
    }

    if (isExceptCompare || isEgMatchCall) {
        if (global.g_cliArgs?.debug) {
            const matchType = isExceptCompare ? cond.right : cond.pparams?.[1];
            console.log(`  EXCEPTION MATCH detected: Creating Except block with condition=${matchType?.constructor?.name} ${matchType?.codeFragment?.()}`);
        }

        const handlerEnd = this.findExceptionHandlerEnd ? this.findExceptionHandlerEnd(this.code.Current.Offset) : null;
        if (this.curBlock.blockType == AST.ASTBlock.BlockType.Except
                && this.curBlock.condition == null) {
            // Reuse current except block (from exception table or pushed by JUMP_FORWARD)
            // instead of creating a nested one. Return immediately to avoid the
            // fall-through that would otherwise create a stray If block on top.
            this.curBlock.condition = isExceptCompare ? cond.right : cond.pparams?.[1];
            if (handlerEnd) {
                this.curBlock.end = handlerEnd;
            }
            this.curBlock.init();
            return;
        } else {
            const end = handlerEnd || offs;
            const matchType = isExceptCompare ? cond.right : cond.pparams?.[1];
            ifblk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, this.code.Current.Offset, end, matchType, false);
            this.inExceptionTableHandler = true;
        }
    } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.Else) {
        if (global.g_cliArgs?.debug) {
            console.log(`  Checking ELIF conditions: size=${this.curBlock.size}, blockType=${this.curBlock.blockType}`);
            if (this.curBlock.size == 1) {
                console.log(`    First node: ${this.curBlock.nodes[0].constructor.name}, blockType=${this.curBlock.nodes[0].blockType}`);
            }
        }

        // Only collapse else→elif when the Else attaches to an If/Elif.
        // `while/for ... else: if X: ...` must stay as a nested if, since
        // rendering `elif` after `while/for` is invalid Python. The Else's
        // prior sibling (last node in the enclosing block) reveals what
        // the Else was created for.
        let elseHolder = this.blocks.length >= 2
            ? this.blocks[this.blocks.length - 2]
            : null;
        let priorSibling = elseHolder && elseHolder.size > 0
            ? elseHolder.nodes[elseHolder.size - 1]
            : null;
        let elseAttachesToIf = priorSibling instanceof AST.ASTCondBlock &&
            (priorSibling.blockType == AST.ASTBlock.BlockType.If ||
             priorSibling.blockType == AST.ASTBlock.BlockType.Elif);

        if (elseAttachesToIf &&
            (this.curBlock.size == 0 ||
             (this.curBlock.size == 1 &&
              this.curBlock.nodes[0] instanceof AST.ASTCondBlock &&
              this.curBlock.nodes[0].blockType == AST.ASTBlock.BlockType.If))) {
            /* Collapse into elif statement */
            if (global.g_cliArgs?.debug) {
                console.log(`ELIF DETECTED: else block size=${this.curBlock.size}, converting to elif at offset ${this.code.Current.Offset}`);
            }
            let startOffset = this.curBlock.start;

            // If else block contains an if statement, remove it (we're converting it to elif)
            if (this.curBlock.size == 1) {
                this.curBlock.nodes.pop();
            }

            this.blocks.pop();
            ifblk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Elif, startOffset, offs, cond, neg);
        }
    } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.Else
                && this.curBlock.size > 0) {
        /* Else block not empty - elif not possible */
        if (global.g_cliArgs?.debug) {
            console.log(`ELIF NOT CREATED: else block size=${this.curBlock.size} (not 0) at offset ${this.code.Current.Offset}, nodes:`, this.curBlock.nodes.map(n => n.constructor.name));
        }
    }
    if (this.curBlock.size == 0 && !this.curBlock.inited
                && this.curBlock.blockType == AST.ASTBlock.BlockType.While
                && this.code.Current.LineNo == this.curBlock.line) {
        /* The condition for a while loop */
        let top = this.blocks.top();
        top.condition = cond;
        top.negative = neg;
        if (popped) {
            top.init(popped);
        }

        if (global.g_cliArgs?.debug) {
            console.log(`[processJumpOps] Set while condition at offset ${this.code.Current.Offset}: ${cond?.constructor?.name} = ${cond?.codeFragment ? cond.codeFragment() : cond}`);
        }
        consumeChainedCompareEpilogue.call(this, top);
        return;
    } else if (this.curBlock.size == 0 && this.curBlock.end <= offs
                && [ AST.ASTBlock.BlockType.If,
                        AST.ASTBlock.BlockType.Elif,
                        AST.ASTBlock.BlockType.While
                    ].includes(this.curBlock.blockType)) {
        let newcond;
        let top = this.curBlock;
        let cond1 = top.condition;
        this.blocks.pop();

        if (this.curBlock.end == offs
                || (this.curBlock.end == this.code.Next?.Offset && !top.negative)) {
            /* if blah and blah */
            newcond = new AST.ASTBinary(cond1, cond, AST.ASTBinary.BinOp.LogicalAnd);
        } else {
            /* if <condition 1> or <condition 2> */
            newcond = new AST.ASTBinary(cond1, cond, AST.ASTBinary.BinOp.LogicalOr);
        }
        newcond.line = this.code.Current.LineNo;
        ifblk = new AST.ASTCondBlock(top.blockType, top.start, offs, newcond, neg);
    } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.For
                && this.curBlock.comprehension
                && this.object.Reader.versionCompare(2, 7) >= 0) {
        /* Comprehension condition */
        let actualCond = cond;
        if (neg) {
            actualCond = new AST.ASTUnary(cond, AST.ASTUnary.UnaryOp.Not);
            actualCond.line = this.code.Current.LineNo;
        }
        this.curBlock.condition = actualCond;
        return;
    }

    if (!ifblk) {
        /* Plain old if statement - but check if it should be elif */
        let shouldBeElif = false;

        // Check if this should be an elif instead of if
        // This happens when there's no else block (e.g., when previous if/elif has return)
        if (this.blocks.length > 0) {
            let parent = this.blocks.top();
            if (parent.size > 0) {
                let lastNode = parent.nodes[parent.size - 1];

                // If the last node in parent is an if/elif block, this should be elif
                // The key insight: if lastNode is CLOSED (not in block stack), it's a sibling
                // Check if lastNode is in block stack - if not, it's closed and safe to use as elif base
                let lastNodeInStack = false;
                for (let i = 0; i < this.blocks.length; i++) {
                    if (this.blocks[i] === lastNode) {
                        lastNodeInStack = true;
                        break;
                    }
                }

                if (lastNode instanceof AST.ASTCondBlock &&
                    (lastNode.blockType == AST.ASTBlock.BlockType.If ||
                     lastNode.blockType == AST.ASTBlock.BlockType.Elif) &&
                    !lastNodeInStack) {  // CLOSED, not in stack = sibling!

                    // Assert-style guards (`if not X: raise`) don't chain as elif.
                    // `assert X; assert Y` and `if not X: raise; if not Y: raise`
                    // share bytecode shape with elif, but rendering the second as
                    // elif creates an orphan `elif` after the first becomes `assert`.
                    let priorIsAssertGuard =
                        lastNode.negative &&
                        lastNode.nodes.length == 1 &&
                        lastNode.nodes[0] instanceof AST.ASTRaise;

                    // A real elif/else requires the prior if's body NOT to fall
                    // through into this test: control must leave via a forward
                    // jump to the merge or a terminator (return/raise). Two
                    // independent consecutive ifs fall through, and rendering the
                    // second as elif changes semantics (`if a: x=1` + `if b: y=1`
                    // -> wrong `if a / elif b`). When the prior body terminates,
                    // `if` and `elif` compile identically, so elif stays valid.
                    // Only suppress on a positively-detected fall-through to avoid
                    // perturbing genuine elif chains.
                    const terminatorOps = new Set([
                        this.OpCodes.RETURN_VALUE, this.OpCodes.RETURN_VALUE_A,
                        this.OpCodes.RETURN_CONST_A, this.OpCodes.RAISE_VARARGS_A,
                        this.OpCodes.RERAISE, this.OpCodes.RERAISE_A,
                        this.OpCodes.JUMP_FORWARD_A, this.OpCodes.JUMP_ABSOLUTE_A,
                        this.OpCodes.JUMP_BACKWARD_A, this.OpCodes.JUMP_BACKWARD_NO_INTERRUPT_A
                    ].filter(v => v !== undefined));
                    let priorFallsThrough = false;
                    if (lastNode.end > 0) {
                        const instrs = this.code.Instructions || [];
                        let lastBodyInstr = null;
                        for (let i = instrs.length - 1; i >= 0; i--) {
                            if (instrs[i] && instrs[i].Offset < lastNode.end) { lastBodyInstr = instrs[i]; break; }
                        }
                        if (lastBodyInstr && !terminatorOps.has(lastBodyInstr.OpCodeID)) {
                            priorFallsThrough = true;
                        }
                    }

                    if (!priorIsAssertGuard && !priorFallsThrough) {
                        shouldBeElif = true;

                        if (global.g_cliArgs?.debug) {
                            console.log(`ELIF DETECTED: Creating elif at offset ${this.code.Current.Offset} (follows ${lastNode.type_str} at ${lastNode.start})`);
                        }
                    }
                }
            }
        }

        if (shouldBeElif) {
            ifblk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Elif, this.code.Current.Offset, offs, cond, neg);
        } else {
            ifblk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.If, this.code.Current.Offset, offs, cond, neg);
        }
        ifblk.line = this.code.Current.LineNo;
    }

    if (ifblk) {
        if (popped)
            ifblk.init(popped);

        this.blocks.push(ifblk);
        this.curBlock = this.blocks.top();

        consumeChainedCompareEpilogue.call(this, ifblk);
    }
}

// Chained comparison in a conditional (`if a < x < b:`). The condition is
// reconstructed correctly (a nested ASTCompare — the value-share prefix
// DUP_TOP+ROT_THREE (≤3.10) / SWAP 2+COPY 2 (3.11+) is treated as a no-op that
// folds the chain), but between the chain's final short-circuit jump and the
// real body the compiler emits a cleanup epilogue:
//
//     POP_JUMP_IF_FALSE/TRUE  <end>     <- creates this if-block (current instr)
//     JUMP_FORWARD            <body>    <- all-compares-true path
//     POP_TOP                           <- pop the duplicated middle value
//     [JUMP_FORWARD           <end>]    <- skip-body (absent when body terminates)
//   body:
//     ...
//
// Without consuming it the JUMP_FORWARD/POP_TOP leak in as the if-body and the
// real body is hoisted out (`if a < x < b: pass` + dangling statements).
// Gated on the nested-ASTCompare chain signature so nothing else is touched.
function consumeChainedCompareEpilogue(ifblk) {
    const reader = this.object?.Reader;
    if (!reader) return;
    if (![AST.ASTBlock.BlockType.If, AST.ASTBlock.BlockType.Elif,
          AST.ASTBlock.BlockType.While].includes(ifblk.blockType)) return;
    const cond = ifblk.condition;
    if (!(cond instanceof AST.ASTCompare) || !(cond.left instanceof AST.ASTCompare)) return;

    const instructions = this.code.Instructions || [];
    const curIdx = this.code.CurrentInstructionIndex;
    // 3.11+ wedges CACHE after the pop-jump; 3.14 also inserts NOT_TAKEN markers
    // before/after the JUMP_FORWARD. Skip both (pure no-ops) when scanning.
    const skipNoise = (startIdx) => {
        let i = startIdx;
        while (i < instructions.length && instructions[i] &&
               [this.OpCodes.CACHE, this.OpCodes.NOT_TAKEN,
                this.OpCodes.INSTRUMENTED_NOT_TAKEN_A].includes(instructions[i].OpCodeID)) {
            i++;
        }
        return i < instructions.length ? i : -1;
    };
    const isPopTop = (ins) => ins && [this.OpCodes.POP_TOP, this.OpCodes.POP_TOP_A].includes(ins.OpCodeID);
    const jfIdx = skipNoise(curIdx + 1);
    const jf = jfIdx >= 0 ? instructions[jfIdx] : null;
    const popIdx = jfIdx >= 0 ? skipNoise(jfIdx + 1) : -1;
    const popTop = popIdx >= 0 ? instructions[popIdx] : null;

    if (jf && jf.OpCodeID === this.OpCodes.JUMP_FORWARD_A && isPopTop(popTop)) {
        // Falls-through body shape: `<final jump>; JUMP_FORWARD <body>; POP_TOP`.
        // JUMP_FORWARD target = next-instruction offset + arg (×2 on 3.10+ per
        // BPO-27129). OpCode.JumpTarget omits the doubling, so compute it here.
        let jfArg = jf.Argument || 0;
        if (reader.versionCompare(3, 10) >= 0) jfArg *= 2;
        const bodyOffset = jf.Offset + (jf.Size || 2) + jfArg;
        const bodyIdx = instructions.findIndex(i => i && i.Offset === bodyOffset);
        if (bodyIdx <= curIdx) return;
        // Leave Current just before the body so the main loop's GoNext lands on
        // it; the epilogue (JUMP_FORWARD/POP_TOP/[JUMP_FORWARD]) is skipped.
        this.code.GoNext(bodyIdx - 1 - curIdx);
        return;
    }

    // Inline-terminator body shape (`if not a<x<b: raise` / `... return`): the
    // body starts right after the final jump with no JUMP_FORWARD, and on
    // 3.10-3.12 the compiler duplicates the block tail at the first compare's
    // short-circuit target (chainSkipTarget = a POP_TOP + a copy of the body).
    // That region is dead in the reconstructed source; record it so the main
    // loop skips it once the inline body closes this block.
    const dead = this.chainSkipTarget;
    if (typeof dead === 'number' && dead > this.code.Current.Offset && dead < ifblk.end) {
        const deadInstr = instructions.find(i => i && i.Offset === dead);
        if (isPopTop(deadInstr)) {
            (this.chainDeadRegions ||= []).push({ from: dead, to: ifblk.end });
        }
    }
    this.chainSkipTarget = undefined;
}

function handleJumpAbsoluteA() {
    if (this.skipNextJump) {
        this.skipNextJump = false;
        return;
    }

    // CRITICAL: Close blocks that have ended before processing jump
    // Unconditional jumps often mark the end of blocks (especially loops)
    while (this.curBlock.end > 0 &&
           this.curBlock.end <= this.code.Current.Offset &&
           this.curBlock.blockType != AST.ASTBlock.BlockType.Main &&
           this.blocks.length > 1) {

        if (global.g_cliArgs?.debug) {
            console.log(`[handleJumpAbsolute] Closing ended block ${this.curBlock.type_str}(${this.curBlock.start}-${this.curBlock.end}) at offset ${this.code.Current.Offset}`);
        }

        let closedBlock = this.blocks.pop();
        this.curBlock = this.blocks.top();
        this.curBlock.append(closedBlock);

        if (global.g_cliArgs?.debug) {
            console.log(`  → Appended to ${this.curBlock.type_str}(${this.curBlock.start}-${this.curBlock.end}), now has ${this.curBlock.nodes.length} nodes`);
        }
    }

    let offs = this.code.Current.Argument;
    if (this.object.Reader.versionCompare(3, 10) >= 0) {
        offs *= 2; // 2 bytes size - BPO-27129
    }

    // [offs] = this.code.FindEndOfBlock(offs);

    // Inside a try-inside-loop (e.g. `while x: try: ... except: ...`),
    // the successful-path jump back to the loop is emitted as JUMP_ABSOLUTE
    // instead of JUMP_FORWARD. If we don't open the Except block here, the
    // handler body ends up appended to the container as raw statements and
    // the `__exception__` placeholder leaks into the output.
    if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container) {
        let cont = this.curBlock;
        if (cont.hasExcept && this.code.Next?.Offset <= cont.except) {
            // Find the END_FINALLY that closes this except so the handler body
            // stays attached to the Except block rather than leaking back into
            // the Container.
            let handlerEnd = cont.except;
            let cursor = cont.except;
            for (let i = 0; i < 200; i++) {
                const instr = this.code.PeekInstructionAtOffset(cursor);
                if (!instr) break;
                if (instr.OpCodeID === this.OpCodes.END_FINALLY) {
                    handlerEnd = instr.Offset;
                    break;
                }
                cursor = instr.Offset + (instr.Size || 3);
            }
            cont.end = handlerEnd;
            let except = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, this.code.Current.Offset, handlerEnd, null, false);
            except.init();
            this.blocks.push(except);
            this.curBlock = this.blocks.top();
            return;
        }
    }

    if (offs <= this.code.Next?.Offset) {
        if (this.curBlock.blockType == AST.ASTBlock.BlockType.For) {
            let is_jump_to_start = offs == this.curBlock.start;
            let should_pop_for_block = this.curBlock.comprehension;
            // in v3.8, SETUP_LOOP is deprecated and for blocks aren't terminated by POP_BLOCK, so we add them here
            let should_add_for_block = this.object.Reader.versionCompare(3, 8) >= 0 && is_jump_to_start && !this.curBlock.comprehension; // ||
                                    //    this.object.Reader.versionCompare(3, 8) < 0 && is_jump_to_start && this.curBlock.comprehension;

            if (should_pop_for_block || should_add_for_block) {
                let top = this.dataStack.top();

                if (top instanceof AST.ASTComprehension) {
                    top.addGenerator(this.curBlock);
                    this.blocks.pop();
                    this.curBlock = this.blocks.top();
                    // For multi-clause comprehensions/genexprs, keep the
                    // ASTComprehension on the data stack so the enclosing
                    // For+comprehension block can attach its own generator.
                    // Only materialize it as a statement once we're clear of
                    // comprehension-tagged for-blocks.
                    if (!(this.curBlock.blockType == AST.ASTBlock.BlockType.For && this.curBlock.comprehension)) {
                        // Detect bare listcomp statement vs assignment/return.
                        // Bare form ends with POP_TOP (possibly after DELETE_FAST/
                        // DELETE_NAME that drops the cached `_[N]`). If POP_TOP
                        // is the terminator, materialize the comprehension as a
                        // statement; otherwise leave it on the stack so the
                        // downstream consumer (STORE_NAME, RETURN_VALUE, CALL,
                        // BINARY_*, …) can use it as an expression.
                        // Generator expressions always materialize as the sole
                        // body statement so the enclosing CALL handler can
                        // extract the comp from the <genexpr> code object.
                        let isBareStatement = top.kind === AST.ASTComprehension.GENERATOR;
                        if (!isBareStatement && this.code.PeekInstructionAtOffset) {
                            let scanOff = this.code.Next?.Offset;
                            const SKIP_OPS = [
                                this.OpCodes.DELETE_FAST_A,
                                this.OpCodes.DELETE_NAME_A,
                                this.OpCodes.DELETE_GLOBAL_A,
                                this.OpCodes.DELETE_DEREF_A,
                                this.OpCodes.JUMP_ABSOLUTE_A,
                                this.OpCodes.JUMP_FORWARD_A
                            ];
                            for (let i = 0; i < 12 && scanOff != null; i++) {
                                const ins = this.code.PeekInstructionAtOffset(scanOff);
                                if (!ins) break;
                                if (SKIP_OPS.includes(ins.OpCodeID)) {
                                    scanOff = ins.Offset + (ins.Size || 3);
                                    continue;
                                }
                                if (ins.OpCodeID == this.OpCodes.POP_TOP) {
                                    // Distinguish real bare-listcomp marker
                                    // from intra-loop skip-path POP_TOP in
                                    // 2.x (which is always followed by a
                                    // JUMP_ABSOLUTE back to FOR_ITER).
                                    const nextIns = this.code.PeekInstructionAtOffset(ins.Offset + (ins.Size || 1));
                                    if (nextIns && SKIP_OPS.includes(nextIns.OpCodeID)) {
                                        scanOff = ins.Offset + (ins.Size || 1);
                                        continue;
                                    }
                                    isBareStatement = true;
                                }
                                break;
                            }
                        }
                        if (isBareStatement) {
                            let comp = this.dataStack.pop();
                            this.curBlock.append(comp);
                        }
                    }
                } else {
                    let tmp = this.curBlock;
                    this.blocks.pop();
                    this.curBlock = this.blocks.top();
                    if (should_add_for_block ||
                        (this.curBlock === this.blocks[0] && this.curBlock.nodes.length == 0)) {
                        this.curBlock.append(tmp);
                    }
                }
            }
        } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.Else) {
            this.blocks.pop();
            this.blocks.top().append(this.curBlock);
            this.curBlock = this.blocks.top();

            if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container
                    && !this.curBlock.hasFinally) {
                this.blocks.pop();
                this.blocks.top().append(this.curBlock);
                this.curBlock = this.blocks.top();
            }
        } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.Except
                && this.code.PeekInstructionAtOffset
                && ![this.OpCodes.JUMP_ABSOLUTE_A, this.OpCodes.JUMP_FORWARD_A].includes(this.code.Prev?.OpCodeID)
                && this.blocks.length >= 2
                && this.blocks[this.blocks.length - 2].blockType == AST.ASTBlock.BlockType.Container) {
            // Python 2.x try/except/else inside a loop: the except handler
            // body ends with JUMP_ABSOLUTE back to the loop start (skipping
            // the else body). Bytecode then has POP_TOP + END_FINALLY + else
            // body, and the else body itself ends with another JUMP_ABSOLUTE
            // to the same loop start. Without this branch, the else body
            // gets attached to the surrounding loop instead of the try.
            let endFinallyAhead = false;
            let scan = this.code.Next?.Offset;
            for (let i = 0; i < 4 && scan != null; i++) {
                const instr = this.code.PeekInstructionAtOffset(scan);
                if (!instr) break;
                if (instr.OpCodeID === this.OpCodes.END_FINALLY) {
                    endFinallyAhead = true;
                    scan = instr.Offset + (instr.Size || 1);
                    break;
                }
                if (instr.OpCodeID !== this.OpCodes.POP_TOP) break;
                scan = instr.Offset + (instr.Size || 1);
            }

            if (endFinallyAhead) {
                // Distinguish try/except/else from try/except (no else) inside
                // a loop. With else: bytecode after END_FINALLY is the else
                // body, then a JUMP_ABSOLUTE to loop start. Without else: the
                // very next instruction is the loop's exit JUMP_ABSOLUTE.
                let elseEnd = scan;
                let cursor = scan;
                let hasBody = false;
                for (let i = 0; i < 200; i++) {
                    const instr = this.code.PeekInstructionAtOffset(cursor);
                    if (!instr) break;
                    if (instr.OpCodeID === this.OpCodes.JUMP_ABSOLUTE_A
                            && instr.JumpTarget === this.code.Current.JumpTarget) {
                        elseEnd = instr.Offset + (instr.Size || 3);
                        break;
                    }
                    if (instr.OpCodeID === this.OpCodes.POP_BLOCK) {
                        elseEnd = instr.Offset;
                        break;
                    }
                    hasBody = true;
                    cursor = instr.Offset + (instr.Size || 3);
                }

                if (!hasBody) {
                    // No else body — fall through to default jump handling.
                } else {
                    let except = this.blocks.pop();
                    this.curBlock = this.blocks.top();
                    if (!except.empty()) {
                        this.curBlock.append(except);
                    }
                    if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container) {
                        this.curBlock.end = elseEnd;
                    }

                    let elseblk = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, this.code.Current.Offset, elseEnd);
                    elseblk.init();
                    this.blocks.push(elseblk);
                    this.curBlock = this.blocks.top();
                    return;
                }
            }
        } else {
            // First of all we have to figure out if there is any While or For blocks wer are in
            let loopBlock = null;
            for (let blockIdx = this.blocks.length - 1; blockIdx > 0; blockIdx--) {
                if ([AST.ASTBlock.BlockType.While, AST.ASTBlock.BlockType.For, AST.ASTBlock.BlockType.AsyncFor].includes(this.blocks[blockIdx].blockType)) {
                    loopBlock = this.blocks[blockIdx];
                    break;
                }
            }

            if (!loopBlock) {
                // Self-referential JUMP_ABSOLUTE with no enclosing loop is a
                // `while True: pass` that 3.8+ emits without SETUP_LOOP. Emit a
                // synthesized while block so the infinite loop is preserved.
                // Pre-3.8 still has SETUP_LOOP and different jump patterns; leave
                // those branches to the existing loop machinery.
                if (offs === this.code.Current.Offset
                        && this.object.Reader.versionCompare(3, 8) >= 0) {
                    const whileBlk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.While, offs, offs, null, false);
                    whileBlk.init();
                    whileBlk.line = this.code.Current.LineNo;
                    whileBlk.append(new AST.ASTKeyword(AST.ASTKeyword.Word.Pass));
                    this.curBlock.append(whileBlk);
                }
                return;
            }

            // CRITICAL FIX: If JUMP target is OUTSIDE current loop (jump to outer loop or beyond),
            // this marks the END of the current loop! Correct the loop's end offset.
            // This handles nested loops where inner loop jumps to outer loop start.
            if (loopBlock.start > offs) {
                // Jump target is BEFORE loop start = jumping to outer scope
                // Current offset should be the TRUE end of this loop
                if (loopBlock.end > this.code.Current.Offset) {
                    if (global.g_cliArgs?.debug) {
                        console.log(`[handleJumpAbsolute] Correcting loop end: ${loopBlock.type_str}(${loopBlock.start}-${loopBlock.end}) → end=${this.code.Current.Offset} (jump to outer at ${offs})`);
                    }
                    loopBlock.end = this.code.Current.Offset;
                }
            }

            if (this.curBlock.end == this.code.Next?.Offset) {
                return;
            }

            if ([this.OpCodes.JUMP_ABSOLUTE_A, this.OpCodes.JUMP_FORWARD_A].includes(this.code.Prev?.OpCodeID)) {
                return;
            }

            // Check if current block ends with a terminating keyword (break/continue/return)
            // This check is recursive - it looks into nested blocks to find terminators
            if (this.hasTerminatingKeyword(this.curBlock)) {
                return;
            }

            if ([AST.ASTBlock.BlockType.If, AST.ASTBlock.BlockType.Elif, AST.ASTBlock.BlockType.Else].includes(this.curBlock.blockType) && this.curBlock.nodes.length == 0) {
                this.curBlock.append(new AST.ASTKeyword(AST.ASTKeyword.Word.Continue));
                return;
            }

            // Let's find actual end of block
            let blockEnd = loopBlock.end;
            let instr = this.code.PeekInstructionAtOffset(blockEnd);
            if (!instr) {
                return;
            }
            let currentIndex = instr.InstructionIndex;

            while (blockEnd > loopBlock.start) {
                if (instr.OpCodeID == this.OpCodes.JUMP_ABSOLUTE_A &&
                    (instr.JumpTarget == loopBlock.start + 3 ||
                        instr.JumpTarget < loopBlock.start)
                ) {
                    currentIndex--;
                    instr = this.code.PeekInstructionAt(currentIndex);
                    blockEnd = instr.Offset;
                } else {
                    return;
                }
            }

            if (this.code.Current.Offset < blockEnd) {
                this.curBlock.append(new AST.ASTKeyword(AST.ASTKeyword.Word.Continue));
            }
        }

        /* We're in a loop, this jumps back to the start */
        /* I think we'll just ignore this case... */
        return; // Bad idea? Probably!
    }

    if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container) {
        let cont = this.curBlock;
        // EXPERIMENT
        if (cont.hasExcept && this.code.Next?.Offset <= cont.except) {
            let except = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, this.code.Current.Offset, this.code.Current.JumpTarget, null, false);
            except.init();
            this.blocks.push(except);
            this.curBlock = this.blocks.top();
        }
        return;
    }

    let prev = this.curBlock;

    if (this.blocks.length > 1) {
        do {
            this.blocks.pop();
            this.blocks.top().append(prev);

            if ([
                    AST.ASTBlock.BlockType.If,
                    AST.ASTBlock.BlockType.Elif
                ].includes(prev.blockType)) {
                let top = this.blocks.top();
                let next = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, this.code.Current.Offset, top.end);
                top.end = this.code.Current.Offset;
                if (prev.inited == AST.ASTCondBlock.InitCondition.PrePopped) {
                    next.init(AST.ASTCondBlock.InitCondition.PrePopped);
                }

                if (global.g_cliArgs?.debug) {
                    console.log(`ELSE BLOCK CREATED at offset ${this.code.Current.Offset}, end=${next.end}`);
                }

                this.blocks.push(next);
                prev = null;
            } else if (prev.blockType == AST.ASTBlock.BlockType.Except) {
                // After closing one handler we speculatively open a fresh
                // Except slot in case another handler follows. But if the
                // chain has no more user-written handlers — only CPython's
                // synthetic END_FINALLY re-raise terminator before our
                // jump target — pushing an empty Except here produces a
                // phantom `except: pass` in the output.
                let chainTerminated = false;
                const target = this.code.Current.JumpTarget;
                const cursorStart = this.code.Next?.Offset;
                if (target != null && cursorStart != null && cursorStart < target) {
                    let cursor = cursorStart;
                    for (let k = 0; k < 32 && cursor < target; k++) {
                        const instr = this.code.PeekInstructionAtOffset(cursor);
                        if (!instr) break;
                        if (instr.OpCodeID === this.OpCodes.END_FINALLY) {
                            chainTerminated = true;
                            break;
                        }
                        cursor = instr.Offset + (instr.Size || 1);
                    }
                }
                if (chainTerminated) {
                    prev = null;
                } else {
                    let top = this.blocks.top();
                    let next = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, top.start, top.end, null, false);
                    next.init();

                    this.blocks.push(next);
                    prev = null;
                }
            } else if (prev.blockType == AST.ASTBlock.BlockType.Else) {
                /* Special case */
                if (this.blocks.top().blockType != AST.ASTBlock.BlockType.Main) {
                    prev = this.blocks.top();
                } else {
                    prev = null;
                }
            } else {
                prev = null;
            }

        } while (prev != null);
    }

    this.curBlock = this.blocks.top();
}

function handleJumpForwardA() {
    processJumpForward.call(this);
}

function handleInstrumentedJumpForwardA() {
    processJumpForward.call(this);
}

function handleJumpA() {
    // Python 3.13+ JUMP: treat as forward jump
    processJumpForward.call(this);
}

function handleJumpNoInterruptA() {
    // Python 3.13+ JUMP_NO_INTERRUPT: same as JUMP for decompilation
    processJumpForward.call(this);
}

function processJumpForward() {
    if (this.skipNextJump) {
        this.skipNextJump = false;
        return;
    }

    // Capture true-branch value for conditional expression (ternary) rewrites.
    if (captureTrueBranchForConditional(this)) {
        return;
    }

    // A forward jump out of the enclosing loop is a `break`. CPython 3.11+ keeps
    // breaks as explicit JUMP_FORWARDs to shared post-loop code (unlike 3.10/3.12
    // which often inline a trailing return); without this they collapse into a
    // spurious `else` or an empty `if ...: pass` that drops the loop exit. Older
    // versions still use SETUP_LOOP/BREAK_LOOP and are handled elsewhere.
    if (this.object.Reader.versionCompare(3, 11) >= 0) {
        let boffs = this.code.Current.Argument;
        if (this.object.Reader.versionCompare(3, 10) >= 0) boffs *= 2;
        const target = (this.code.Next?.Offset ?? 0) + boffs;
        for (let bi = this.blocks.length - 1; bi >= 0; bi--) {
            const b = this.blocks[bi];
            if ([AST.ASTBlock.BlockType.While, AST.ASTBlock.BlockType.For,
                 AST.ASTBlock.BlockType.AsyncFor].includes(b.blockType)) {
                // b.end is the loop-back offset; a jump *to* it is normal loop
                // iteration (or a `continue`), only a jump *past* it (to post-loop
                // code) is a `break`. Use strict `>` so the try-success path that
                // targets the loop-back is not mistaken for a break.
                if (b.end > 0 && this.code.Current.Offset < b.end && target > b.end) {
                    if (!this.hasTerminatingKeyword(this.curBlock)) {
                        this.curBlock.append(new AST.ASTKeyword(AST.ASTKeyword.Word.Break));
                    }
                    return;
                }
                break; // only the innermost enclosing loop governs a break
            }
        }
    }

    let offs = this.code.Current.Argument;
    if (this.object.Reader.versionCompare(3, 10) >= 0)
        offs *= 2; // 2 bytes per offset as per BPO-27129

    if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container) {
        let cont = this.curBlock;
        if (cont.hasExcept) {
            this.curBlock.end = this.code.Next?.Offset + offs;
            let except = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, this.code.Current.Offset, this.curBlock.end, null, false);
            except.init();
            this.blocks.push(except);
            this.curBlock = this.blocks.top();
        }
        return;
    }

    let prev = this.curBlock;

    if (this.blocks.length > 1) {
        do {
            this.blocks.pop();

            if (!this.blocks.empty())
                this.blocks.top().append(prev);

            if (prev.blockType == AST.ASTBlock.BlockType.If
                    || prev.blockType == AST.ASTBlock.BlockType.Elif) {
                if (offs < 3) {
                    prev = null;
                    continue;
                }
                let next = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, this.code.Current.Offset, this.code.Next?.Offset + offs);
                if (prev.inited == AST.ASTCondBlock.InitCondition.PrePopped) {
                    next.init(AST.ASTCondBlock.InitCondition.PrePopped);
                }

                this.blocks.push(next);
                prev = null;
            } else if (prev.blockType == AST.ASTBlock.BlockType.Except && offs > 2) {
                // For exception groups: only create chained except if there's another CHECK_EG_MATCH ahead.
                // Internal cleanup jumps should not create new except blocks.
                if (this.inExceptionGroup) {
                    const jumpTarget = this.code.Next?.Offset + offs;
                    let hasNextEgMatch = false;
                    // Scan ahead to see if there's a CHECK_EG_MATCH within reasonable range
                    let scanOffset = this.code.Next?.Offset;
                    for (let i = 0; i < 40 && scanOffset <= jumpTarget + 20; i++) {
                        const instr = this.code.PeekInstructionAtOffset(scanOffset);
                        if (!instr) break;
                        if (instr.OpCodeID === this.OpCodes.CHECK_EG_MATCH) {
                            hasNextEgMatch = true;
                            break;
                        }
                        if (instr.OpCodeID === this.OpCodes.CALL_INTRINSIC_2 ||
                            instr.OpCodeID === this.OpCodes.POP_EXCEPT ||
                            instr.OpCodeID === this.OpCodes.RERAISE) {
                            // Reached cleanup, no more handlers
                            break;
                        }
                        scanOffset += 2;
                    }
                    if (!hasNextEgMatch) {
                        prev = null;
                        break;
                    }
                }
                let next = null;

                // try/except/else: JUMP_FORWARD at end of except handler skips
                // past END_FINALLY and the else body. Detect by scanning the
                // few instructions between code.Next and the JUMP target for
                // an END_FINALLY (Python 2.x emits POP_TOP before END_FINALLY).
                let jumpTarget = this.code.Next?.Offset + offs;
                let nextIsElse = this.code.Next?.OpCodeID == this.OpCodes.END_FINALLY;
                if (!nextIsElse && this.code.PeekInstructionAtOffset) {
                    let scan = this.code.Next?.Offset;
                    for (let i = 0; i < 4 && scan != null && scan < jumpTarget; i++) {
                        const instr = this.code.PeekInstructionAtOffset(scan);
                        if (!instr) break;
                        if (instr.OpCodeID === this.OpCodes.END_FINALLY) {
                            nextIsElse = true;
                            break;
                        }
                        if (instr.OpCodeID !== this.OpCodes.POP_TOP) break;
                        scan = instr.Offset + instr.Size;
                    }
                }

                if (nextIsElse) {
                    next = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, this.code.Current.Offset, this.code.Current.JumpTarget);
                    next.init();
                } else {
                    next = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, this.code.Current.Offset, this.code.Next?.Offset + offs, null, false);
                    next.init();
                }

                this.blocks.push(next);
                prev = null;
            } else if (prev.blockType == AST.ASTBlock.BlockType.Else) {
                /* Special case */
                prev = this.blocks.top();

                if (prev.blockType == AST.ASTBlock.BlockType.Main) {
                    /* Something went out of the control! */
                    prev = null;
                }
            } else if (prev.blockType == AST.ASTBlock.BlockType.Try
                    && prev.end < this.code.Next?.Offset + offs) {
                this.dataStack.pop();

                if (this.blocks.top().blockType == AST.ASTBlock.BlockType.Container) {
                    let cont = this.blocks.top();
                    if (cont.hasExcept) {

                        let except = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, prev.end, this.code.Next?.Offset + offs, null, false);
                        except.init();
                        this.blocks.push(except);
                    }
                } else {
                    if (global.g_cliArgs?.debug) {
                        console.error("Something TERRIBLE happened!!\n");
                    }
                }
                prev = null;
            } else {
                prev = null;
            }

        } while (prev != null);
    }

    this.curBlock = this.blocks.top();

    if (this.curBlock.blockType == AST.ASTBlock.BlockType.Except) {
        this.curBlock.end = this.code.Next?.Offset + offs;
    }
}

function handleJumpBackwardA() {
    // Python 3.11+ JUMP_BACKWARD: either a loop's own loop-back (structural; the
    // infinite/duplicated-condition while detectors dead-region-skip it, and a
    // for-loop's loop-back arrives with curBlock == the loop itself), or a
    // `continue` from inside a conditional in the loop body.

    if (global.g_cliArgs?.debug) {
        console.log(`[JUMP_BACKWARD] at offset ${this.code.Current.Offset}, target_delta=${this.code.Current.Argument}`);
    }

    const instrs = this.code.Instructions || [];
    const idx = this.code.CurrentInstructionIndex;
    let arg = (this.code.Current.Argument || 0) * 2; // 3.11+ wordcode (BPO-27129)
    let j = idx + 1;
    while (j < instrs.length && instrs[j] && instrs[j].OpCodeID === this.OpCodes.CACHE) j++;
    const base = (j < instrs.length && instrs[j]) ? instrs[j].Offset
               : (this.code.Current.Offset + (this.code.Current.Size || 2));
    const target = base - arg;

    let loop = null;
    for (let bi = this.blocks.length - 1; bi >= 0; bi--) {
        const b = this.blocks[bi];
        if ([AST.ASTBlock.BlockType.While, AST.ASTBlock.BlockType.For,
             AST.ASTBlock.BlockType.AsyncFor].includes(b.blockType)) { loop = b; break; }
    }
    if (!loop) return;
    if (![AST.ASTBlock.BlockType.If, AST.ASTBlock.BlockType.Elif,
          AST.ASTBlock.BlockType.Else].includes(this.curBlock.blockType)) return;
    if (this.hasTerminatingKeyword(this.curBlock)) return;

    // `continue` re-enters the loop: on a duplicated-condition/dup-guard while it
    // targets the top condition, which sits ABOVE the loop's body start (target <
    // loop.start); on `while True`/for it targets the loop top itself, in which
    // case a LATER back-edge to the same target (the true loop-back) must exist —
    // if this instruction were the farthest back-edge it would BE the loop-back.
    let isContinue = target < loop.start;
    if (!isContinue && target === loop.start && typeof this.getBackJumpMap === 'function') {
        const farthest = this.getBackJumpMap().get(target);
        isContinue = !!(farthest && farthest.offset > this.code.Current.Offset);
    }
    if (isContinue) {
        this.curBlock.append(new AST.ASTKeyword(AST.ASTKeyword.Word.Continue));
    }
}

function handleJumpBackwardNoInterruptA() {
    // Python 3.11+ JUMP_BACKWARD_NO_INTERRUPT
    // Like JUMP_BACKWARD but doesn't check for pending signals
    // Used in tight loops for optimization

    if (global.g_cliArgs?.debug) {
        console.log(`[JUMP_BACKWARD_NO_INTERRUPT] at offset ${this.code.Current.Offset}`);
    }

    // Same as JUMP_BACKWARD for decompiler purposes
}

function handleJumpIfNotExcMatchA() {
    // Use same logic as other conditional jumps; stack top is comparison result.
    processJumpOps.call(this);
}

function handleNotTaken() {
    // Instrumentation hint (3.13+) used in instrumented builds; ignore for decompilation.
    if (global.g_cliArgs?.debug) {
        console.log(`[NOT_TAKEN] at offset ${this.code.Current.Offset}`);
    }
}

function handleInstrumentedNotTakenA() {
    // Instrumentation marker for untaken branch; no stack effect.
    if (global.g_cliArgs?.debug) {
        console.log(`[INSTRUMENTED_NOT_TAKEN] at offset ${this.code.Current.Offset}`);
    }
}

module.exports = {
    handleJumpIfFalseA,
    handleJumpIfTrueA,
    handleJumpIfFalseOrPopA,
    handleJumpIfTrueOrPopA,
    handlePopJumpIfFalseA,
    handlePopJumpIfTrueA,
    handlePopJumpForwardIfFalseA,
    handlePopJumpForwardIfTrueA,
    handlePopJumpForwardIfNoneA,
    handlePopJumpForwardIfNotNoneA,
    handlePopJumpBackwardIfNoneA,
    handlePopJumpBackwardIfNotNoneA,
    handlePopJumpIfNoneA,
    handlePopJumpIfNotNoneA,
    handleInstrumentedPopJumpIfFalseA,
    handleInstrumentedPopJumpIfTrueA,
    handleInstrumentedPopJumpIfNoneA,
    handleInstrumentedPopJumpIfNotNoneA,
    handleJumpAbsoluteA,
    handleJumpForwardA,
    handleInstrumentedJumpForwardA,
    handleJumpA,
    handleJumpNoInterruptA,
    handleJumpBackwardA,
    handleJumpBackwardNoInterruptA,
    handleJumpIfNotExcMatchA,
    handleNotTaken,
    handleInstrumentedNotTakenA,
    resolveBoolChainFrames
};

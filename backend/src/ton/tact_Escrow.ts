import {
    Cell,
    Slice,
    Address,
    Builder,
    beginCell,
    ComputeError,
    TupleItem,
    TupleReader,
    Dictionary,
    contractAddress,
    address,
    ContractProvider,
    Sender,
    Contract,
    ContractABI,
    ABIType,
    ABIGetter,
    ABIReceiver,
    TupleBuilder,
    DictionaryValue
} from '@ton/core';

export type DataSize = {
    $$type: 'DataSize';
    cells: bigint;
    bits: bigint;
    refs: bigint;
}

export function storeDataSize(src: DataSize) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.cells, 257);
        b_0.storeInt(src.bits, 257);
        b_0.storeInt(src.refs, 257);
    };
}

export function loadDataSize(slice: Slice) {
    const sc_0 = slice;
    const _cells = sc_0.loadIntBig(257);
    const _bits = sc_0.loadIntBig(257);
    const _refs = sc_0.loadIntBig(257);
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function loadTupleDataSize(source: TupleReader) {
    const _cells = source.readBigNumber();
    const _bits = source.readBigNumber();
    const _refs = source.readBigNumber();
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function loadGetterTupleDataSize(source: TupleReader) {
    const _cells = source.readBigNumber();
    const _bits = source.readBigNumber();
    const _refs = source.readBigNumber();
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function storeTupleDataSize(source: DataSize) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.cells);
    builder.writeNumber(source.bits);
    builder.writeNumber(source.refs);
    return builder.build();
}

export function dictValueParserDataSize(): DictionaryValue<DataSize> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDataSize(src)).endCell());
        },
        parse: (src) => {
            return loadDataSize(src.loadRef().beginParse());
        }
    }
}

export type SignedBundle = {
    $$type: 'SignedBundle';
    signature: Buffer;
    signedData: Slice;
}

export function storeSignedBundle(src: SignedBundle) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBuffer(src.signature);
        b_0.storeBuilder(src.signedData.asBuilder());
    };
}

export function loadSignedBundle(slice: Slice) {
    const sc_0 = slice;
    const _signature = sc_0.loadBuffer(64);
    const _signedData = sc_0;
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function loadTupleSignedBundle(source: TupleReader) {
    const _signature = source.readBuffer();
    const _signedData = source.readCell().asSlice();
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function loadGetterTupleSignedBundle(source: TupleReader) {
    const _signature = source.readBuffer();
    const _signedData = source.readCell().asSlice();
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function storeTupleSignedBundle(source: SignedBundle) {
    const builder = new TupleBuilder();
    builder.writeBuffer(source.signature);
    builder.writeSlice(source.signedData.asCell());
    return builder.build();
}

export function dictValueParserSignedBundle(): DictionaryValue<SignedBundle> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSignedBundle(src)).endCell());
        },
        parse: (src) => {
            return loadSignedBundle(src.loadRef().beginParse());
        }
    }
}

export type StateInit = {
    $$type: 'StateInit';
    code: Cell;
    data: Cell;
}

export function storeStateInit(src: StateInit) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeRef(src.code);
        b_0.storeRef(src.data);
    };
}

export function loadStateInit(slice: Slice) {
    const sc_0 = slice;
    const _code = sc_0.loadRef();
    const _data = sc_0.loadRef();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function loadTupleStateInit(source: TupleReader) {
    const _code = source.readCell();
    const _data = source.readCell();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function loadGetterTupleStateInit(source: TupleReader) {
    const _code = source.readCell();
    const _data = source.readCell();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function storeTupleStateInit(source: StateInit) {
    const builder = new TupleBuilder();
    builder.writeCell(source.code);
    builder.writeCell(source.data);
    return builder.build();
}

export function dictValueParserStateInit(): DictionaryValue<StateInit> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeStateInit(src)).endCell());
        },
        parse: (src) => {
            return loadStateInit(src.loadRef().beginParse());
        }
    }
}

export type Context = {
    $$type: 'Context';
    bounceable: boolean;
    sender: Address;
    value: bigint;
    raw: Slice;
}

export function storeContext(src: Context) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.bounceable);
        b_0.storeAddress(src.sender);
        b_0.storeInt(src.value, 257);
        b_0.storeRef(src.raw.asCell());
    };
}

export function loadContext(slice: Slice) {
    const sc_0 = slice;
    const _bounceable = sc_0.loadBit();
    const _sender = sc_0.loadAddress();
    const _value = sc_0.loadIntBig(257);
    const _raw = sc_0.loadRef().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function loadTupleContext(source: TupleReader) {
    const _bounceable = source.readBoolean();
    const _sender = source.readAddress();
    const _value = source.readBigNumber();
    const _raw = source.readCell().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function loadGetterTupleContext(source: TupleReader) {
    const _bounceable = source.readBoolean();
    const _sender = source.readAddress();
    const _value = source.readBigNumber();
    const _raw = source.readCell().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function storeTupleContext(source: Context) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.bounceable);
    builder.writeAddress(source.sender);
    builder.writeNumber(source.value);
    builder.writeSlice(source.raw.asCell());
    return builder.build();
}

export function dictValueParserContext(): DictionaryValue<Context> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeContext(src)).endCell());
        },
        parse: (src) => {
            return loadContext(src.loadRef().beginParse());
        }
    }
}

export type SendParameters = {
    $$type: 'SendParameters';
    mode: bigint;
    body: Cell | null;
    code: Cell | null;
    data: Cell | null;
    value: bigint;
    to: Address;
    bounce: boolean;
}

export function storeSendParameters(src: SendParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        if (src.code !== null && src.code !== undefined) { b_0.storeBit(true).storeRef(src.code); } else { b_0.storeBit(false); }
        if (src.data !== null && src.data !== undefined) { b_0.storeBit(true).storeRef(src.data); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeAddress(src.to);
        b_0.storeBit(src.bounce);
    };
}

export function loadSendParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _code = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _data = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _to = sc_0.loadAddress();
    const _bounce = sc_0.loadBit();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function loadTupleSendParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _code = source.readCellOpt();
    const _data = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function loadGetterTupleSendParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _code = source.readCellOpt();
    const _data = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function storeTupleSendParameters(source: SendParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeCell(source.code);
    builder.writeCell(source.data);
    builder.writeNumber(source.value);
    builder.writeAddress(source.to);
    builder.writeBoolean(source.bounce);
    return builder.build();
}

export function dictValueParserSendParameters(): DictionaryValue<SendParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSendParameters(src)).endCell());
        },
        parse: (src) => {
            return loadSendParameters(src.loadRef().beginParse());
        }
    }
}

export type MessageParameters = {
    $$type: 'MessageParameters';
    mode: bigint;
    body: Cell | null;
    value: bigint;
    to: Address;
    bounce: boolean;
}

export function storeMessageParameters(src: MessageParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeAddress(src.to);
        b_0.storeBit(src.bounce);
    };
}

export function loadMessageParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _to = sc_0.loadAddress();
    const _bounce = sc_0.loadBit();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function loadTupleMessageParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function loadGetterTupleMessageParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function storeTupleMessageParameters(source: MessageParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeNumber(source.value);
    builder.writeAddress(source.to);
    builder.writeBoolean(source.bounce);
    return builder.build();
}

export function dictValueParserMessageParameters(): DictionaryValue<MessageParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeMessageParameters(src)).endCell());
        },
        parse: (src) => {
            return loadMessageParameters(src.loadRef().beginParse());
        }
    }
}

export type DeployParameters = {
    $$type: 'DeployParameters';
    mode: bigint;
    body: Cell | null;
    value: bigint;
    bounce: boolean;
    init: StateInit;
}

export function storeDeployParameters(src: DeployParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeBit(src.bounce);
        b_0.store(storeStateInit(src.init));
    };
}

export function loadDeployParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _bounce = sc_0.loadBit();
    const _init = loadStateInit(sc_0);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function loadTupleDeployParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _bounce = source.readBoolean();
    const _init = loadTupleStateInit(source);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function loadGetterTupleDeployParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _bounce = source.readBoolean();
    const _init = loadGetterTupleStateInit(source);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function storeTupleDeployParameters(source: DeployParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeNumber(source.value);
    builder.writeBoolean(source.bounce);
    builder.writeTuple(storeTupleStateInit(source.init));
    return builder.build();
}

export function dictValueParserDeployParameters(): DictionaryValue<DeployParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeployParameters(src)).endCell());
        },
        parse: (src) => {
            return loadDeployParameters(src.loadRef().beginParse());
        }
    }
}

export type StdAddress = {
    $$type: 'StdAddress';
    workchain: bigint;
    address: bigint;
}

export function storeStdAddress(src: StdAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.workchain, 8);
        b_0.storeUint(src.address, 256);
    };
}

export function loadStdAddress(slice: Slice) {
    const sc_0 = slice;
    const _workchain = sc_0.loadIntBig(8);
    const _address = sc_0.loadUintBig(256);
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function loadTupleStdAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readBigNumber();
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function loadGetterTupleStdAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readBigNumber();
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function storeTupleStdAddress(source: StdAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.workchain);
    builder.writeNumber(source.address);
    return builder.build();
}

export function dictValueParserStdAddress(): DictionaryValue<StdAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeStdAddress(src)).endCell());
        },
        parse: (src) => {
            return loadStdAddress(src.loadRef().beginParse());
        }
    }
}

export type VarAddress = {
    $$type: 'VarAddress';
    workchain: bigint;
    address: Slice;
}

export function storeVarAddress(src: VarAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.workchain, 32);
        b_0.storeRef(src.address.asCell());
    };
}

export function loadVarAddress(slice: Slice) {
    const sc_0 = slice;
    const _workchain = sc_0.loadIntBig(32);
    const _address = sc_0.loadRef().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function loadTupleVarAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readCell().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function loadGetterTupleVarAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readCell().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function storeTupleVarAddress(source: VarAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.workchain);
    builder.writeSlice(source.address.asCell());
    return builder.build();
}

export function dictValueParserVarAddress(): DictionaryValue<VarAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVarAddress(src)).endCell());
        },
        parse: (src) => {
            return loadVarAddress(src.loadRef().beginParse());
        }
    }
}

export type BasechainAddress = {
    $$type: 'BasechainAddress';
    hash: bigint | null;
}

export function storeBasechainAddress(src: BasechainAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        if (src.hash !== null && src.hash !== undefined) { b_0.storeBit(true).storeInt(src.hash, 257); } else { b_0.storeBit(false); }
    };
}

export function loadBasechainAddress(slice: Slice) {
    const sc_0 = slice;
    const _hash = sc_0.loadBit() ? sc_0.loadIntBig(257) : null;
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function loadTupleBasechainAddress(source: TupleReader) {
    const _hash = source.readBigNumberOpt();
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function loadGetterTupleBasechainAddress(source: TupleReader) {
    const _hash = source.readBigNumberOpt();
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function storeTupleBasechainAddress(source: BasechainAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.hash);
    return builder.build();
}

export function dictValueParserBasechainAddress(): DictionaryValue<BasechainAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBasechainAddress(src)).endCell());
        },
        parse: (src) => {
            return loadBasechainAddress(src.loadRef().beginParse());
        }
    }
}

export type Deploy = {
    $$type: 'Deploy';
    queryId: bigint;
}

export function storeDeploy(src: Deploy) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2490013878, 32);
        b_0.storeUint(src.queryId, 64);
    };
}

export function loadDeploy(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2490013878) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'Deploy' as const, queryId: _queryId };
}

export function loadTupleDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Deploy' as const, queryId: _queryId };
}

export function loadGetterTupleDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Deploy' as const, queryId: _queryId };
}

export function storeTupleDeploy(source: Deploy) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}

export function dictValueParserDeploy(): DictionaryValue<Deploy> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeploy(src)).endCell());
        },
        parse: (src) => {
            return loadDeploy(src.loadRef().beginParse());
        }
    }
}

export type DeployOk = {
    $$type: 'DeployOk';
    queryId: bigint;
}

export function storeDeployOk(src: DeployOk) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2952335191, 32);
        b_0.storeUint(src.queryId, 64);
    };
}

export function loadDeployOk(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2952335191) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'DeployOk' as const, queryId: _queryId };
}

export function loadTupleDeployOk(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'DeployOk' as const, queryId: _queryId };
}

export function loadGetterTupleDeployOk(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'DeployOk' as const, queryId: _queryId };
}

export function storeTupleDeployOk(source: DeployOk) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}

export function dictValueParserDeployOk(): DictionaryValue<DeployOk> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeployOk(src)).endCell());
        },
        parse: (src) => {
            return loadDeployOk(src.loadRef().beginParse());
        }
    }
}

export type FactoryDeploy = {
    $$type: 'FactoryDeploy';
    queryId: bigint;
    cashback: Address;
}

export function storeFactoryDeploy(src: FactoryDeploy) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1829761339, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeAddress(src.cashback);
    };
}

export function loadFactoryDeploy(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1829761339) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _cashback = sc_0.loadAddress();
    return { $$type: 'FactoryDeploy' as const, queryId: _queryId, cashback: _cashback };
}

export function loadTupleFactoryDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _cashback = source.readAddress();
    return { $$type: 'FactoryDeploy' as const, queryId: _queryId, cashback: _cashback };
}

export function loadGetterTupleFactoryDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _cashback = source.readAddress();
    return { $$type: 'FactoryDeploy' as const, queryId: _queryId, cashback: _cashback };
}

export function storeTupleFactoryDeploy(source: FactoryDeploy) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeAddress(source.cashback);
    return builder.build();
}

export function dictValueParserFactoryDeploy(): DictionaryValue<FactoryDeploy> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFactoryDeploy(src)).endCell());
        },
        parse: (src) => {
            return loadFactoryDeploy(src.loadRef().beginParse());
        }
    }
}

export type ChangeOwner = {
    $$type: 'ChangeOwner';
    queryId: bigint;
    newOwner: Address;
}

export function storeChangeOwner(src: ChangeOwner) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2174598809, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeAddress(src.newOwner);
    };
}

export function loadChangeOwner(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2174598809) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _newOwner = sc_0.loadAddress();
    return { $$type: 'ChangeOwner' as const, queryId: _queryId, newOwner: _newOwner };
}

export function loadTupleChangeOwner(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _newOwner = source.readAddress();
    return { $$type: 'ChangeOwner' as const, queryId: _queryId, newOwner: _newOwner };
}

export function loadGetterTupleChangeOwner(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _newOwner = source.readAddress();
    return { $$type: 'ChangeOwner' as const, queryId: _queryId, newOwner: _newOwner };
}

export function storeTupleChangeOwner(source: ChangeOwner) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeAddress(source.newOwner);
    return builder.build();
}

export function dictValueParserChangeOwner(): DictionaryValue<ChangeOwner> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeChangeOwner(src)).endCell());
        },
        parse: (src) => {
            return loadChangeOwner(src.loadRef().beginParse());
        }
    }
}

export type ChangeOwnerOk = {
    $$type: 'ChangeOwnerOk';
    queryId: bigint;
    newOwner: Address;
}

export function storeChangeOwnerOk(src: ChangeOwnerOk) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(846932810, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeAddress(src.newOwner);
    };
}

export function loadChangeOwnerOk(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 846932810) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _newOwner = sc_0.loadAddress();
    return { $$type: 'ChangeOwnerOk' as const, queryId: _queryId, newOwner: _newOwner };
}

export function loadTupleChangeOwnerOk(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _newOwner = source.readAddress();
    return { $$type: 'ChangeOwnerOk' as const, queryId: _queryId, newOwner: _newOwner };
}

export function loadGetterTupleChangeOwnerOk(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _newOwner = source.readAddress();
    return { $$type: 'ChangeOwnerOk' as const, queryId: _queryId, newOwner: _newOwner };
}

export function storeTupleChangeOwnerOk(source: ChangeOwnerOk) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeAddress(source.newOwner);
    return builder.build();
}

export function dictValueParserChangeOwnerOk(): DictionaryValue<ChangeOwnerOk> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeChangeOwnerOk(src)).endCell());
        },
        parse: (src) => {
            return loadChangeOwnerOk(src.loadRef().beginParse());
        }
    }
}

export type Lock = {
    $$type: 'Lock';
    jobId: string;
}

export function storeLock(src: Lock) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3355794161, 32);
        b_0.storeStringRefTail(src.jobId);
    };
}

export function loadLock(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3355794161) { throw Error('Invalid prefix'); }
    const _jobId = sc_0.loadStringRefTail();
    return { $$type: 'Lock' as const, jobId: _jobId };
}

export function loadTupleLock(source: TupleReader) {
    const _jobId = source.readString();
    return { $$type: 'Lock' as const, jobId: _jobId };
}

export function loadGetterTupleLock(source: TupleReader) {
    const _jobId = source.readString();
    return { $$type: 'Lock' as const, jobId: _jobId };
}

export function storeTupleLock(source: Lock) {
    const builder = new TupleBuilder();
    builder.writeString(source.jobId);
    return builder.build();
}

export function dictValueParserLock(): DictionaryValue<Lock> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeLock(src)).endCell());
        },
        parse: (src) => {
            return loadLock(src.loadRef().beginParse());
        }
    }
}

export type Deliver = {
    $$type: 'Deliver';
    jobId: string;
}

export function storeDeliver(src: Deliver) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1883121709, 32);
        b_0.storeStringRefTail(src.jobId);
    };
}

export function loadDeliver(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1883121709) { throw Error('Invalid prefix'); }
    const _jobId = sc_0.loadStringRefTail();
    return { $$type: 'Deliver' as const, jobId: _jobId };
}

export function loadTupleDeliver(source: TupleReader) {
    const _jobId = source.readString();
    return { $$type: 'Deliver' as const, jobId: _jobId };
}

export function loadGetterTupleDeliver(source: TupleReader) {
    const _jobId = source.readString();
    return { $$type: 'Deliver' as const, jobId: _jobId };
}

export function storeTupleDeliver(source: Deliver) {
    const builder = new TupleBuilder();
    builder.writeString(source.jobId);
    return builder.build();
}

export function dictValueParserDeliver(): DictionaryValue<Deliver> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeliver(src)).endCell());
        },
        parse: (src) => {
            return loadDeliver(src.loadRef().beginParse());
        }
    }
}

export type Confirm = {
    $$type: 'Confirm';
    jobId: string;
}

export function storeConfirm(src: Confirm) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(310564437, 32);
        b_0.storeStringRefTail(src.jobId);
    };
}

export function loadConfirm(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 310564437) { throw Error('Invalid prefix'); }
    const _jobId = sc_0.loadStringRefTail();
    return { $$type: 'Confirm' as const, jobId: _jobId };
}

export function loadTupleConfirm(source: TupleReader) {
    const _jobId = source.readString();
    return { $$type: 'Confirm' as const, jobId: _jobId };
}

export function loadGetterTupleConfirm(source: TupleReader) {
    const _jobId = source.readString();
    return { $$type: 'Confirm' as const, jobId: _jobId };
}

export function storeTupleConfirm(source: Confirm) {
    const builder = new TupleBuilder();
    builder.writeString(source.jobId);
    return builder.build();
}

export function dictValueParserConfirm(): DictionaryValue<Confirm> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeConfirm(src)).endCell());
        },
        parse: (src) => {
            return loadConfirm(src.loadRef().beginParse());
        }
    }
}

export type Dispute = {
    $$type: 'Dispute';
    jobId: string;
}

export function storeDispute(src: Dispute) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3648487639, 32);
        b_0.storeStringRefTail(src.jobId);
    };
}

export function loadDispute(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3648487639) { throw Error('Invalid prefix'); }
    const _jobId = sc_0.loadStringRefTail();
    return { $$type: 'Dispute' as const, jobId: _jobId };
}

export function loadTupleDispute(source: TupleReader) {
    const _jobId = source.readString();
    return { $$type: 'Dispute' as const, jobId: _jobId };
}

export function loadGetterTupleDispute(source: TupleReader) {
    const _jobId = source.readString();
    return { $$type: 'Dispute' as const, jobId: _jobId };
}

export function storeTupleDispute(source: Dispute) {
    const builder = new TupleBuilder();
    builder.writeString(source.jobId);
    return builder.build();
}

export function dictValueParserDispute(): DictionaryValue<Dispute> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDispute(src)).endCell());
        },
        parse: (src) => {
            return loadDispute(src.loadRef().beginParse());
        }
    }
}

export type Expire = {
    $$type: 'Expire';
    jobId: string;
}

export function storeExpire(src: Expire) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3664876966, 32);
        b_0.storeStringRefTail(src.jobId);
    };
}

export function loadExpire(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3664876966) { throw Error('Invalid prefix'); }
    const _jobId = sc_0.loadStringRefTail();
    return { $$type: 'Expire' as const, jobId: _jobId };
}

export function loadTupleExpire(source: TupleReader) {
    const _jobId = source.readString();
    return { $$type: 'Expire' as const, jobId: _jobId };
}

export function loadGetterTupleExpire(source: TupleReader) {
    const _jobId = source.readString();
    return { $$type: 'Expire' as const, jobId: _jobId };
}

export function storeTupleExpire(source: Expire) {
    const builder = new TupleBuilder();
    builder.writeString(source.jobId);
    return builder.build();
}

export function dictValueParserExpire(): DictionaryValue<Expire> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeExpire(src)).endCell());
        },
        parse: (src) => {
            return loadExpire(src.loadRef().beginParse());
        }
    }
}

export type Escrow$Data = {
    $$type: 'Escrow$Data';
    hirer: Address;
    worker: Address;
    treasury: Address;
    amount: bigint;
    deadline: bigint;
    jobId: string;
    protocolFeeBps: bigint;
    status: bigint;
}

export function storeEscrow$Data(src: Escrow$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.hirer);
        b_0.storeAddress(src.worker);
        b_0.storeAddress(src.treasury);
        b_0.storeCoins(src.amount);
        b_0.storeUint(src.deadline, 64);
        b_0.storeStringRefTail(src.jobId);
        b_0.storeUint(src.protocolFeeBps, 16);
        b_0.storeUint(src.status, 8);
    };
}

export function loadEscrow$Data(slice: Slice) {
    const sc_0 = slice;
    const _hirer = sc_0.loadAddress();
    const _worker = sc_0.loadAddress();
    const _treasury = sc_0.loadAddress();
    const _amount = sc_0.loadCoins();
    const _deadline = sc_0.loadUintBig(64);
    const _jobId = sc_0.loadStringRefTail();
    const _protocolFeeBps = sc_0.loadUintBig(16);
    const _status = sc_0.loadUintBig(8);
    return { $$type: 'Escrow$Data' as const, hirer: _hirer, worker: _worker, treasury: _treasury, amount: _amount, deadline: _deadline, jobId: _jobId, protocolFeeBps: _protocolFeeBps, status: _status };
}

export function loadTupleEscrow$Data(source: TupleReader) {
    const _hirer = source.readAddress();
    const _worker = source.readAddress();
    const _treasury = source.readAddress();
    const _amount = source.readBigNumber();
    const _deadline = source.readBigNumber();
    const _jobId = source.readString();
    const _protocolFeeBps = source.readBigNumber();
    const _status = source.readBigNumber();
    return { $$type: 'Escrow$Data' as const, hirer: _hirer, worker: _worker, treasury: _treasury, amount: _amount, deadline: _deadline, jobId: _jobId, protocolFeeBps: _protocolFeeBps, status: _status };
}

export function loadGetterTupleEscrow$Data(source: TupleReader) {
    const _hirer = source.readAddress();
    const _worker = source.readAddress();
    const _treasury = source.readAddress();
    const _amount = source.readBigNumber();
    const _deadline = source.readBigNumber();
    const _jobId = source.readString();
    const _protocolFeeBps = source.readBigNumber();
    const _status = source.readBigNumber();
    return { $$type: 'Escrow$Data' as const, hirer: _hirer, worker: _worker, treasury: _treasury, amount: _amount, deadline: _deadline, jobId: _jobId, protocolFeeBps: _protocolFeeBps, status: _status };
}

export function storeTupleEscrow$Data(source: Escrow$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.hirer);
    builder.writeAddress(source.worker);
    builder.writeAddress(source.treasury);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.deadline);
    builder.writeString(source.jobId);
    builder.writeNumber(source.protocolFeeBps);
    builder.writeNumber(source.status);
    return builder.build();
}

export function dictValueParserEscrow$Data(): DictionaryValue<Escrow$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeEscrow$Data(src)).endCell());
        },
        parse: (src) => {
            return loadEscrow$Data(src.loadRef().beginParse());
        }
    }
}

 type Escrow_init_args = {
    $$type: 'Escrow_init_args';
    hirer: Address;
    worker: Address;
    treasury: Address;
    deadline: bigint;
    jobId: string;
}

function initEscrow_init_args(src: Escrow_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.hirer);
        b_0.storeAddress(src.worker);
        b_0.storeAddress(src.treasury);
        const b_1 = new Builder();
        b_1.storeInt(src.deadline, 257);
        b_1.storeStringRefTail(src.jobId);
        b_0.storeRef(b_1.endCell());
    };
}

async function Escrow_init(hirer: Address, worker: Address, treasury: Address, deadline: bigint, jobId: string) {
    const __code = Cell.fromHex('b5ee9c72410222010006d3000228ff008e88f4a413f4bcf2c80bed5320e303ed43d90112020378e00210020120030b020120040902015805070196aaeced44d0d200018e16fa40fa40fa40fa00d33fd401d001d30fd30755706c188e24fa40fa40fa40d401d0810101d700d430d010251024102305d15503708100c85413031023e2db3c6c81060002240196a90aed44d0d200018e16fa40fa40fa40fa00d33fd401d001d30fd30755706c188e24fa40fa40fa40d401d0810101d700d430d010251024102305d15503708100c85413031023e2db3c6c81080002200197b3dd7b51343480006385be903e903e903e8034cff500740074c3f4c1d55c1b0623893e903e903e9035007420404075c0350c34040944090408c1745540dc2040321504c0c408f8b6cf1b20600a0002260201200c0e0197b34dbb51343480006385be903e903e903e8034cff500740074c3f4c1d55c1b0623893e903e903e9035007420404075c0350c34040944090408c1745540dc2040321504c0c408f8b6cf1b20600d0002270197b30cfb51343480006385be903e903e903e8034cff500740074c3f4c1d55c1b0623893e903e903e9035007420404075c0350c34040944090408c1745540dc2040321504c0c408f8b6cf1b20600f0002220197b8536ed44d0d200018e16fa40fa40fa40fa00d33fd401d001d30fd30755706c188e24fa40fa40fa40d401d0810101d700d430d010251024102305d15503708100c85413031023e2db3c6c8181100022302f63001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e16fa40fa40fa40fa00d33fd401d001d30fd30755706c188e24fa40fa40fa40d401d0810101d700d430d010251024102305d15503708100c85413031023e209925f09e007d70d1ff2e082218210c8055af1bae302218210703e282dba131400aa31d430d0815b0df84228c705f2f481735f29c000f2f482009c2a511201f90101f901baf2f4f8416f24135f0313a0105710461035504403c87f01ca0055705078ce15ce13ce01fa02cb3f01c8cecdcb0fcb07c9ed5404e28e4831d430d0811533f84227c705f2f481735f09c00019f2f482009c2a518101f90101f901ba18f2f4551471c87f01ca0055705078ce15ce13ce01fa02cb3f01c8cecdcb0fcb07c9ed54e02182101282d655bae302218210d97780d7bae302218210da7195a6bae302018210946a98b6ba15181a2103fe31d430d081733cf84228c705f2f48200d29209c00119f2f482009c2a518101f90101f901ba18f2f4725326a8812710a9045330a122882855205a6d6d40037fc8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0020c2009130e30d1057104610354430121617200030000000004261746f6e3a206a6f6220636f6d706c65746564017621882655205a6d6d40037fc8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb001f02dc31d430d0815debf84228c705f2f48200d29209c00119f2f482009c2a518101f90101f901ba18f2f4737288275445305a6d6d40037fc8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0010571046103544301219200042000000004261746f6e3a206a6f622064697370757465642c20726566756e64656403f431d430d08200bc49f82324bef2f4811c7729c000917f9329c001e2f2f482009c2a511201f90101f901baf2f407c00174018ebc7288275445305a6d6d40037fc8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00e30d1057104610354430121b1c200040000000004261746f6e3a206a6f6220657870697265642c20726566756e646564029a5326a8812710a9045330a172882855205a6d6d40037fc8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0020c2009130e30d1d1e004e000000004261746f6e3a206175746f2d72656c656173656420616674657220646561646c696e65017672882655205a6d6d40037fc8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb001f002e000000004261746f6e3a2070726f746f636f6c20666565003cc87f01ca0055705078ce15ce13ce01fa02cb3f01c8cecdcb0fcb07c9ed5400ca8e5dd33f30c8018210aff90f5758cb1fcb3fc91068105710461035443012f84270705003804201503304c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00c87f01ca0055705078ce15ce13ce01fa02cb3f01c8cecdcb0fcb07c9ed54e05f09f2c082b860a702');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initEscrow_init_args({ $$type: 'Escrow_init_args', hirer, worker, treasury, deadline, jobId })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const Escrow_errors = {
    2: { message: "Stack underflow" },
    3: { message: "Stack overflow" },
    4: { message: "Integer overflow" },
    5: { message: "Integer out of expected range" },
    6: { message: "Invalid opcode" },
    7: { message: "Type check error" },
    8: { message: "Cell overflow" },
    9: { message: "Cell underflow" },
    10: { message: "Dictionary error" },
    11: { message: "'Unknown' error" },
    12: { message: "Fatal error" },
    13: { message: "Out of gas error" },
    14: { message: "Virtualization error" },
    32: { message: "Action list is invalid" },
    33: { message: "Action list is too long" },
    34: { message: "Action is invalid or not supported" },
    35: { message: "Invalid source address in outbound message" },
    36: { message: "Invalid destination address in outbound message" },
    37: { message: "Not enough Toncoin" },
    38: { message: "Not enough extra currencies" },
    39: { message: "Outbound message does not fit into a cell after rewriting" },
    40: { message: "Cannot process a message" },
    41: { message: "Library reference is null" },
    42: { message: "Library change action error" },
    43: { message: "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree" },
    50: { message: "Account state size exceeded limits" },
    128: { message: "Null reference exception" },
    129: { message: "Invalid serialization prefix" },
    130: { message: "Invalid incoming message" },
    131: { message: "Constraints error" },
    132: { message: "Access denied" },
    133: { message: "Contract stopped" },
    134: { message: "Invalid argument" },
    135: { message: "Code of a contract was not found" },
    136: { message: "Invalid standard address" },
    138: { message: "Not a basechain address" },
    5427: { message: "Only worker can deliver" },
    7287: { message: "Cannot expire in current state" },
    23309: { message: "Only hirer can lock funds" },
    24043: { message: "Only hirer can dispute" },
    29500: { message: "Only hirer can confirm" },
    29535: { message: "Escrow not in created state" },
    39978: { message: "Job ID mismatch" },
    48201: { message: "Deadline not reached" },
    53906: { message: "Must be delivered first" },
} as const

export const Escrow_errors_backward = {
    "Stack underflow": 2,
    "Stack overflow": 3,
    "Integer overflow": 4,
    "Integer out of expected range": 5,
    "Invalid opcode": 6,
    "Type check error": 7,
    "Cell overflow": 8,
    "Cell underflow": 9,
    "Dictionary error": 10,
    "'Unknown' error": 11,
    "Fatal error": 12,
    "Out of gas error": 13,
    "Virtualization error": 14,
    "Action list is invalid": 32,
    "Action list is too long": 33,
    "Action is invalid or not supported": 34,
    "Invalid source address in outbound message": 35,
    "Invalid destination address in outbound message": 36,
    "Not enough Toncoin": 37,
    "Not enough extra currencies": 38,
    "Outbound message does not fit into a cell after rewriting": 39,
    "Cannot process a message": 40,
    "Library reference is null": 41,
    "Library change action error": 42,
    "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree": 43,
    "Account state size exceeded limits": 50,
    "Null reference exception": 128,
    "Invalid serialization prefix": 129,
    "Invalid incoming message": 130,
    "Constraints error": 131,
    "Access denied": 132,
    "Contract stopped": 133,
    "Invalid argument": 134,
    "Code of a contract was not found": 135,
    "Invalid standard address": 136,
    "Not a basechain address": 138,
    "Only worker can deliver": 5427,
    "Cannot expire in current state": 7287,
    "Only hirer can lock funds": 23309,
    "Only hirer can dispute": 24043,
    "Only hirer can confirm": 29500,
    "Escrow not in created state": 29535,
    "Job ID mismatch": 39978,
    "Deadline not reached": 48201,
    "Must be delivered first": 53906,
} as const

const Escrow_types: ABIType[] = [
    {"name":"DataSize","header":null,"fields":[{"name":"cells","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bits","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"refs","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"SignedBundle","header":null,"fields":[{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signedData","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"StateInit","header":null,"fields":[{"name":"code","type":{"kind":"simple","type":"cell","optional":false}},{"name":"data","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"Context","header":null,"fields":[{"name":"bounceable","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender","type":{"kind":"simple","type":"address","optional":false}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"raw","type":{"kind":"simple","type":"slice","optional":false}}]},
    {"name":"SendParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"code","type":{"kind":"simple","type":"cell","optional":true}},{"name":"data","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"to","type":{"kind":"simple","type":"address","optional":false}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"MessageParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"to","type":{"kind":"simple","type":"address","optional":false}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"DeployParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}},{"name":"init","type":{"kind":"simple","type":"StateInit","optional":false}}]},
    {"name":"StdAddress","header":null,"fields":[{"name":"workchain","type":{"kind":"simple","type":"int","optional":false,"format":8}},{"name":"address","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"VarAddress","header":null,"fields":[{"name":"workchain","type":{"kind":"simple","type":"int","optional":false,"format":32}},{"name":"address","type":{"kind":"simple","type":"slice","optional":false}}]},
    {"name":"BasechainAddress","header":null,"fields":[{"name":"hash","type":{"kind":"simple","type":"int","optional":true,"format":257}}]},
    {"name":"Deploy","header":2490013878,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"DeployOk","header":2952335191,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"FactoryDeploy","header":1829761339,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"cashback","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ChangeOwner","header":2174598809,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"newOwner","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ChangeOwnerOk","header":846932810,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"newOwner","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"Lock","header":3355794161,"fields":[{"name":"jobId","type":{"kind":"simple","type":"string","optional":false}}]},
    {"name":"Deliver","header":1883121709,"fields":[{"name":"jobId","type":{"kind":"simple","type":"string","optional":false}}]},
    {"name":"Confirm","header":310564437,"fields":[{"name":"jobId","type":{"kind":"simple","type":"string","optional":false}}]},
    {"name":"Dispute","header":3648487639,"fields":[{"name":"jobId","type":{"kind":"simple","type":"string","optional":false}}]},
    {"name":"Expire","header":3664876966,"fields":[{"name":"jobId","type":{"kind":"simple","type":"string","optional":false}}]},
    {"name":"Escrow$Data","header":null,"fields":[{"name":"hirer","type":{"kind":"simple","type":"address","optional":false}},{"name":"worker","type":{"kind":"simple","type":"address","optional":false}},{"name":"treasury","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"deadline","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"jobId","type":{"kind":"simple","type":"string","optional":false}},{"name":"protocolFeeBps","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"status","type":{"kind":"simple","type":"uint","optional":false,"format":8}}]},
]

const Escrow_opcodes = {
    "Deploy": 2490013878,
    "DeployOk": 2952335191,
    "FactoryDeploy": 1829761339,
    "ChangeOwner": 2174598809,
    "ChangeOwnerOk": 846932810,
    "Lock": 3355794161,
    "Deliver": 1883121709,
    "Confirm": 310564437,
    "Dispute": 3648487639,
    "Expire": 3664876966,
}

const Escrow_getters: ABIGetter[] = [
    {"name":"status","methodId":101642,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"amount","methodId":101100,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"jobId","methodId":113715,"arguments":[],"returnType":{"kind":"simple","type":"string","optional":false}},
    {"name":"hirer","methodId":109878,"arguments":[],"returnType":{"kind":"simple","type":"address","optional":false}},
    {"name":"worker","methodId":106357,"arguments":[],"returnType":{"kind":"simple","type":"address","optional":false}},
    {"name":"deadline","methodId":116022,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
]

export const Escrow_getterMapping: { [key: string]: string } = {
    'status': 'getStatus',
    'amount': 'getAmount',
    'jobId': 'getJobId',
    'hirer': 'getHirer',
    'worker': 'getWorker',
    'deadline': 'getDeadline',
}

const Escrow_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"Lock"}},
    {"receiver":"internal","message":{"kind":"typed","type":"Deliver"}},
    {"receiver":"internal","message":{"kind":"typed","type":"Confirm"}},
    {"receiver":"internal","message":{"kind":"typed","type":"Dispute"}},
    {"receiver":"internal","message":{"kind":"typed","type":"Expire"}},
    {"receiver":"internal","message":{"kind":"typed","type":"Deploy"}},
]


export class Escrow implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = Escrow_errors_backward;
    public static readonly opcodes = Escrow_opcodes;
    
    static async init(hirer: Address, worker: Address, treasury: Address, deadline: bigint, jobId: string) {
        return await Escrow_init(hirer, worker, treasury, deadline, jobId);
    }
    
    static async fromInit(hirer: Address, worker: Address, treasury: Address, deadline: bigint, jobId: string) {
        const __gen_init = await Escrow_init(hirer, worker, treasury, deadline, jobId);
        const address = contractAddress(0, __gen_init);
        return new Escrow(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new Escrow(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  Escrow_types,
        getters: Escrow_getters,
        receivers: Escrow_receivers,
        errors: Escrow_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: Lock | Deliver | Confirm | Dispute | Expire | Deploy) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'Lock') {
            body = beginCell().store(storeLock(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'Deliver') {
            body = beginCell().store(storeDeliver(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'Confirm') {
            body = beginCell().store(storeConfirm(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'Dispute') {
            body = beginCell().store(storeDispute(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'Expire') {
            body = beginCell().store(storeExpire(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'Deploy') {
            body = beginCell().store(storeDeploy(message)).endCell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getStatus(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('status', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getAmount(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('amount', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getJobId(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('jobId', builder.build())).stack;
        const result = source.readString();
        return result;
    }
    
    async getHirer(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('hirer', builder.build())).stack;
        const result = source.readAddress();
        return result;
    }
    
    async getWorker(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('worker', builder.build())).stack;
        const result = source.readAddress();
        return result;
    }
    
    async getDeadline(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('deadline', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
}
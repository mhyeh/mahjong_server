export enum CommandType {
    NONE           = 0b0000000,	// 沒有
    COMMAND_PON    = 0b0000001, // 碰
    COMMAND_GON    = 0b0000010, // 直槓
    COMMAND_ONGON  = 0b0000100, // 暗槓
    COMMAND_PONGON = 0b0001000, // 面下槓
    COMMAND_HU     = 0b0010000, // 胡
    COMMAND_ZIMO   = 0b0100000, // 自摸
}

export async function InitHuTable(): Promise<boolean> {
    let i;
    if (!g_data) {
        return false;
    }
    g_group.push(0);
    for (i = 0; i < 9; i++) {
        g_group.push(3 << i * 3);
    }
    for (i = 0; i < 7; i++) {
        g_group.push(73 << i * 3);
    }
    for (i = 0; i < 9; i++) {
        g_eye.push(2 << i * 3);
    }
    await B01(4, 0, SIZE);
    await B2(4, 0, 1);
    await B3(7, 0, 1);
    await B4();
    await B5(4, 0, 1);
    await B6();
    await B7();
    await B8(4, 0, SIZE);
    await B9UP();
    await T();
    console.log("Initialization Completed!");
    return true;
}

export async  function SSJ(hand: number, door: number): Promise<number> {
    const idx = (((g_data[hand & 134217727] | 4) &
        (g_data[hand >> 27] | 4) &
        (g_data[door & 134217727] | 64) &
        (g_data[door >> 27] | 64) &
        (484 | ((g_data[door & 134217727] & g_data[door >> 27] & 16) >> 1)))
        | (((g_data[hand & 134217727] & (g_data[door & 134217727] | 3)) | (g_data[hand >> 27] & (g_data[door >> 27] | 3))) & 19)
        | ((g_data[(hand & 134217727) + (door & 134217727)] & 3584) + (g_data[(hand >> 27) + (door >> 27)] & 3584)));
    return g_data[SIZE + idx];
}

const SIZE = 76695844;
const MAX  = 76699939;

const GROUP_3_Size18 = [3, 24, 192, 1536, 12288, 98304, 786432, 6291456, 50331648, 402653184, 3221225472, 25769803776, 206158430208, 1649267441664, 13194139533312, 105553116266496, 844424930131968, 6755399441055744];
const GROUP_123_size14 = [73, 584, 4672, 37376, 299008, 2392064, 19136512, 9797894144, 78383153152, 627065225216, 5016521801728, 40132174413824, 321057395310592, 2568459162484736];
const GROUP_2_size18 = [2, 16, 128, 1024, 8192, 65536, 524288, 4194304, 33554432, 268435456, 2147483648, 17179869184, 137438953472, 1099511627776, 8796093022208, 70368744177664, 562949953421312, 4503599627370496];
const GROUP_12_size16 = [9, 72, 576, 4608, 36864, 294912, 2359296, 18874368, 1207959552, 9663676416, 77309411328, 618475290624, 4947802324992, 39582418599936, 316659348799488, 2533274790395904];
const GROUP_13_size14 = [65, 520, 4160, 33280, 266240, 2129920, 17039360, 8724152320, 69793218560, 558345748480, 4466765987840, 35734127902720, 285873023221760, 2286984185774080];

const g_data:  number[] = new Array<number>(MAX);
const g_group: number[] = [];
const g_eye:   number[] = [];

async function have(m: number, s: number): Promise<boolean> {
    let i;
    for (i = 0; i < 9; i++) {
        if (((m >> i * 3) & 7) < ((s >> i * 3) & 7)) {
            return false;
        }
    }

    return true;
}

async function B01(n: number, d: number, p: number): Promise<void> {
    let i;
    if (n) {
        for (i = 0; i < 17; i++) {
            if (await have(p, g_group[i])) {
                await B01(n - 1, d + g_group[i], p - g_group[i]);
            }
        }
    } else {
        g_data[d] |= 1;
        for (i = 0; i < 9; i++) {
            if (await have(p, g_eye[i])) {
                g_data[d + g_eye[i]] |= 2;
            }
        }
    }
}

async function B2(n: number, d: number, c: number): Promise<void> {
    let i;
    g_data[d] |= 4;
    g_data[d] |= 32;
    if ((d & 16777208) === 0) {
        g_data[d] |= 256;
    }
    if (n) {
        for (i = c; i <= 9; i++) {
            await B2(n - 1, d + g_group[i], i + 1);
            await B2(n - 1, d + g_group[i] / 3 * 4, i + 1);
        }
    }
}

async function B3(n: number, d: number, c: number): Promise<void> {
    let i;
    g_data[d] |= 8;
    if (n) {
        for (i = c; i <= 9; i++) {
            B3(n - 1, d + g_group[i] / 3 * 2, i + 1);
            B3(n - 2, d + g_group[i] / 3 * 4, i + 1);
        }
    }
}

async function B4(): Promise<void> {
    g_data[0] |= 16;
}

async function B5(n: number, d: number, c: number): Promise<void> {
    let i;
    g_data[d] |= 32;
    for (i = 0; i < 9; i++) {
        if (await have(SIZE - d, g_eye[i])) {
            g_data[d + g_eye[i]] |= 32;
        }
    }
    if (n) {
        for (i = c; i <= 9; i++) {
            await B5(n - 1, d + g_group[i], i + 1);
        }
    }
}

async function B6(): Promise<void> {
    let i;
    g_data[0] |= 64;
    for (i = 0; i < 9; i++) {
        g_data[g_eye[i]] |= 64;
    }
}

async function B7(): Promise<void> {
    let i;
    for (i = 0; i < SIZE; i++) {
        if ((i & 119508935) === 0) {
            g_data[i] |= 128;
        }
    }
}

async function B8(n: number, d: number, p: number): Promise<void> {
    let i;
    if (n) {
        for (i = 0; i < 17; i++) {
            if (await have(p, g_group[i]) && (i === 0 || i === 1 || i === 9 || i === 10 || i === 16)) {
                await B8(n - 1, d + g_group[i], p - g_group[i]);
            }
        }
    } else {
        g_data[d] |= 256;
        for (i = 0; i < 9; i++) {
            if (await have(p, g_eye[i]) && (i === 0 || i === 8)) {
                g_data[d + g_eye[i]] |= 256;
            }
        }
    }
}

async function B9UP(): Promise<void> {
    let i;
    let j;
    let k;
    for (i = 0; i < SIZE; i++) {
        k = 0;
        for (j = 0; j < 9; j++) {
            if (i & (4 << j * 3)) {
                k++;
            }
        }
        if (k > 7) {
            k = 7;
        }
        g_data[i] |= (k << 9);
    }
}

async function T(): Promise<void> {
    let i;
    let k;
    for (i = 0; i < 4095; i++) {
        k = 0;
        if ((i & 7) === 7) {
            k = 1;
            if ((i & 32) === 32) {
                k = 2;
            }
            if ((i & 16) === 16) {
                k = 3;
            }
            if ((i & 64) === 64) {
                k = 3;
            }
            if ((i & 256) === 256) {
                k = 3;
            }
            if ((i & 48) === 48) {
                k = 4;
            }
            if ((i & 160) === 160) {
                k = 4;
            }
            if ((i & 272) === 272) {
                k = 5;
            }
            if ((i & 80) === 80) {
                k = 5;
            }
            if ((i & 192) === 192) {
                k = 5;
            }
            k += (i >> 9);
        } else if (i & 8) {
            k = 3;
            if ((i & 16) === 16) {
                k = 5;
            }
            if (i >> 9) {
                k = 4;
            }
            if ((i & 16) === 16 && (i >> 9)) {
                k = 5;
            }
            k += (i >> 9);
        }
        g_data[SIZE + i] = k;
    }
}

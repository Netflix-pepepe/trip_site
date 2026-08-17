/* =========================================================
   人狼オンライン トリップ検索 Worker
   10桁 / 12桁
   ========================================================= */

"use strict";

/* ---------------------------------------------------------
   unix-crypt-td.min.js を読み込む
   --------------------------------------------------------- */

try {
    importScripts("./unix-crypt-td.min.js");
} catch (e) {
    self.postMessage({
        type: "error",
        message:
            "unix-crypt-td.min.js の読み込みに失敗しました: " +
            (e && e.message ? e.message : e)
    });
}

/*
 * 貼ってもらったライブラリは Worker では
 *
 *     window.unixCryptTD = z
 *
 * が実行されません。
 *
 * そのためライブラリ内部の var z を拾って
 * Worker側の unixCryptTD に接続します。
 */

if (
    typeof self.unixCryptTD !== "function" &&
    typeof unixCryptTD === "function"
) {
    self.unixCryptTD = unixCryptTD;
}

if (
    typeof self.unixCryptTD !== "function" &&
    typeof z === "function"
) {
    self.unixCryptTD = z;
}

/* ---------------------------------------------------------
   状態
   --------------------------------------------------------- */

let running = false;
let workerId = 0;
let workerCount = 1;

const CHARS =
    "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/*
 * 64文字
 *
 * ./0-9A-Za-z
 */

const BASE = 64;

/* ---------------------------------------------------------
   文字列生成
   --------------------------------------------------------- */

/*
 * BigInt の番号からキーを作る
 */
function indexToKey(index, length) {
    let s = "";

    for (let i = 0; i < length; i++) {
        const r = Number(index % 64n);
        s = CHARS[r] + s;
        index = index / 64n;
    }

    return s;
}

/* ---------------------------------------------------------
   10桁トリップ
   --------------------------------------------------------- */

function make10Trip(key) {

    if (typeof self.unixCryptTD !== "function") {
        throw new Error("unixCryptTD unavailable");
    }

    /*
     * 2ch系10桁トリップのsalt生成
     */

    const saltSource = key + "H.";

    let c1 = saltSource.charCodeAt(1) || 46;
    let c2 = saltSource.charCodeAt(2) || 46;

    function saltChar(c) {

        if (c >= 0x3a && c <= 0x40) {
            c += 7;
        }

        if (c >= 0x5b && c <= 0x60) {
            c += 6;
        }

        if (c < 0x2e || c > 0x7a) {
            c = 0x2e;
        }

        return String.fromCharCode(c);
    }

    const salt =
        saltChar(c1) +
        saltChar(c2);

    const result =
        self.unixCryptTD(key, salt);

    return String(result).slice(-10);
}

/* ---------------------------------------------------------
   SHA-1
   --------------------------------------------------------- */

function rotl(x, n) {
    return (x << n) | (x >>> (32 - n));
}

function sha1Bytes(bytes) {

    const originalLength = bytes.length;

    const bitLength =
        originalLength * 8;

    const paddedLength =
        ((originalLength + 9 + 63) >> 6) << 6;

    const data =
        new Uint8Array(paddedLength);

    data.set(bytes);

    data[originalLength] = 0x80;

    /*
     * JSでは安全な範囲なので通常の整数で十分
     */
    const high =
        Math.floor(bitLength / 0x100000000);

    const low =
        bitLength >>> 0;

    data[paddedLength - 8] =
        (high >>> 24) & 255;

    data[paddedLength - 7] =
        (high >>> 16) & 255;

    data[paddedLength - 6] =
        (high >>> 8) & 255;

    data[paddedLength - 5] =
        high & 255;

    data[paddedLength - 4] =
        (low >>> 24) & 255;

    data[paddedLength - 3] =
        (low >>> 16) & 255;

    data[paddedLength - 2] =
        (low >>> 8) & 255;

    data[paddedLength - 1] =
        low & 255;

    let h0 = 0x67452301;
    let h1 = 0xefcdab89;
    let h2 = 0x98badcfe;
    let h3 = 0x10325476;
    let h4 = 0xc3d2e1f0;

    const w = new Uint32Array(80);

    for (
        let offset = 0;
        offset < paddedLength;
        offset += 64
    ) {

        for (let i = 0; i < 16; i++) {

            const p = offset + i * 4;

            w[i] =
                ((data[p] << 24) |
                (data[p + 1] << 16) |
                (data[p + 2] << 8) |
                data[p + 3]) >>> 0;
        }

        for (let i = 16; i < 80; i++) {

            w[i] =
                rotl(
                    w[i - 3] ^
                    w[i - 8] ^
                    w[i - 14] ^
                    w[i - 16],
                    1
                ) >>> 0;
        }

        let a = h0;
        let b = h1;
        let c = h2;
        let d = h3;
        let e = h4;

        for (let i = 0; i < 80; i++) {

            let f;
            let k;

            if (i < 20) {

                f =
                    (b & c) |
                    ((~b) & d);

                k = 0x5a827999;

            } else if (i < 40) {

                f =
                    b ^ c ^ d;

                k = 0x6ed9eba1;

            } else if (i < 60) {

                f =
                    (b & c) |
                    (b & d) |
                    (c & d);

                k = 0x8f1bbcdc;

            } else {

                f =
                    b ^ c ^ d;

                k = 0xca62c1d6;
            }

            const temp =
                (
                    rotl(a, 5) +
                    f +
                    e +
                    k +
                    w[i]
                ) >>> 0;

            e = d;
            d = c;
            c = rotl(b, 30) >>> 0;
            b = a;
            a = temp;
        }

        h0 = (h0 + a) >>> 0;
        h1 = (h1 + b) >>> 0;
        h2 = (h2 + c) >>> 0;
        h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0;
    }

    const out = new Uint8Array(20);

    const hs = [
        h0,
        h1,
        h2,
        h3,
        h4
    ];

    for (let i = 0; i < 5; i++) {

        out[i * 4] =
            (hs[i] >>> 24) & 255;

        out[i * 4 + 1] =
            (hs[i] >>> 16) & 255;

        out[i * 4 + 2] =
            (hs[i] >>> 8) & 255;

        out[i * 4 + 3] =
            hs[i] & 255;
    }

    return out;
}

/* ---------------------------------------------------------
   ASCII → UTF-8
   --------------------------------------------------------- */

function stringBytes(str) {

    /*
     * 検索文字はASCIIなので高速化のため
     * TextEncoderを使わず直接変換
     */

    const out =
        new Uint8Array(str.length);

    for (let i = 0; i < str.length; i++) {
        out[i] =
            str.charCodeAt(i) & 255;
    }

    return out;
}

/* ---------------------------------------------------------
   12桁
   --------------------------------------------------------- */

function make12Trip(key) {

    const hash =
        sha1Bytes(
            stringBytes(key)
        );

    /*
     * SHA-1 → Base64
     */

    let binary = "";

    for (let i = 0; i < hash.length; i++) {
        binary += String.fromCharCode(hash[i]);
    }

    let result =
        btoa(binary)
        .slice(0, 12)
        .replace(/\+/g, ".");

    return result;
}

/* ---------------------------------------------------------
   トリップ生成
   --------------------------------------------------------- */

function makeTrip(key, length) {

    if (length === 12) {
        return make12Trip(key);
    }

    return make10Trip(key);
}

/* ---------------------------------------------------------
   正規表現
   --------------------------------------------------------- */

function buildRegex(pattern) {

    try {
        return new RegExp(pattern);
    } catch (e) {
        throw new Error(
            "正規表現エラー: " +
            e.message
        );
    }
}

/* ---------------------------------------------------------
   条件判定
   --------------------------------------------------------- */

function matchCondition(
    trip,
    conditions
) {

    for (const c of conditions) {

        const value =
            String(c.value ?? "");

        if (c.regex) {

            const re =
                buildRegex(value);

            if (!re.test(trip)) {
                return false;
            }

            continue;
        }

        switch (c.mode) {

            case "contains":

                if (!trip.includes(value)) {
                    return false;
                }

                break;

            case "starts":

                if (!trip.startsWith(value)) {
                    return false;
                }

                break;

            case "ends":

                if (!trip.endsWith(value)) {
                    return false;
                }

                break;

            case "exact":

                if (trip !== value) {
                    return false;
                }

                break;
        }
    }

    return true;
}

/* ---------------------------------------------------------
   特殊トリップ
   --------------------------------------------------------- */

function specialTrip(
    trip,
    type
) {

    if (!type) {
        return true;
    }

    /*
     * 純n連
     */
    if (type === "pure") {

        let max = 1;

        let cur = 1;

        for (let i = 1; i < trip.length; i++) {

            if (trip[i] === trip[i - 1]) {

                cur++;

            } else {

                cur = 1;
            }

            if (cur > max) {
                max = cur;
            }
        }

        return max >= 8;
    }

    /*
     * 準n連
     */
    if (type === "quasi") {

        const s =
            trip.toLowerCase();

        let max = 1;

        let cur = 1;

        for (let i = 1; i < s.length; i++) {

            if (s[i] === s[i - 1]) {

                cur++;

            } else {

                cur = 1;
            }

            if (cur > max) {
                max = cur;
            }
        }

        return max >= 9;
    }

    /*
     * 二構
     */
    if (type === "two") {

        return new Set(trip).size === 2;
    }

    /*
     * 最長
     */
    if (type === "longest") {

        return /^[MmW]+$/.test(trip);
    }

    /*
     * 最短
     */
    if (type === "shortest") {

        return /^[li.]+$/.test(trip);
    }

    /*
     * 八雲
     *
     * 例:
     * aaabbbcccX
     *
     * 3文字ずつのまとまりが
     * 連続しているか
     */

    if (type === "yakumo") {

        if (trip.length < 9) {
            return false;
        }

        for (let i = 0; i + 2 < trip.length; i += 3) {

            if (
                trip[i] !== trip[i + 1] ||
                trip[i] !== trip[i + 2]
            ) {
                return false;
            }
        }

        return true;
    }

    /*
     * 鏡
     *
     * 見た目の鏡文字
     */

    if (type === "mirror") {

        const mirror = {
            ".": ".",
            "0": "0",
            "8": "8",
            "A": "A",
            "H": "H",
            "I": "I",
            "M": "M",
            "O": "O",
            "T": "T",
            "U": "U",
            "V": "V",
            "W": "W",
            "X": "X",
            "Y": "Y",
            "b": "d",
            "d": "b",
            "p": "q",
            "q": "p",
            "i": "i",
            "l": "l",
            "o": "o"
        };

        for (let i = 0; i < trip.length; i++) {

            const a =
                trip[i];

            const b =
                trip[trip.length - 1 - i];

            if (
                !mirror[a] ||
                mirror[a] !== b
            ) {
                return false;
            }
        }

        return true;
    }

    /*
     * 回文
     */

    if (type === "palindrome") {

        for (let i = 0; i < trip.length / 2; i++) {

            if (
                trip[i] !==
                trip[trip.length - 1 - i]
            ) {
                return false;
            }
        }

        return true;
    }

    /*
     * 山彦
     *
     * 前半 = 後半
     */

    if (type === "echo") {

        if (trip.length % 2 !== 0) {
            return false;
        }

        const half =
            trip.length / 2;

        return (
            trip.slice(0, half) ===
            trip.slice(half)
        );
    }

    /*
     * 双連
     *
     * aa bb cc dd ee
     */

    if (type === "double") {

        if (trip.length % 2 !== 0) {
            return false;
        }

        for (let i = 0; i < trip.length; i += 2) {

            if (
                trip[i] !==
                trip[i + 1]
            ) {
                return false;
            }
        }

        return true;
    }

    /*
     * 全数
     */

    if (type === "numbers") {

        return /^[0-9]+$/.test(trip);
    }

    /*
     * 飛石
     *
     * 1文字おきに . または /
     */

    if (type === "stepping") {

        for (let i = 1; i < trip.length; i += 2) {

            if (
                trip[i] !== "." &&
                trip[i] !== "/"
            ) {
                return false;
            }
        }

        return true;
    }

    /*
     * 拡飛
     *
     * 同じ区切り文字が1文字おき
     */

    if (type === "expanded") {

        if (trip.length < 2) {
            return false;
        }

        const separator =
            trip[1];

        if (
            separator !== "." &&
            separator !== "/"
        ) {
            return false;
        }

        for (let i = 1; i < trip.length; i += 2) {

            if (trip[i] !== separator) {
                return false;
            }
        }

        return true;
    }

    return true;
}

/* ---------------------------------------------------------
   メイン検索
   --------------------------------------------------------- */

self.onmessage = function (event) {

    const data =
        event.data || {};

    if (data.type === "start") {

        running = true;

        workerId =
            Number(data.workerId || 0);

        workerCount =
            Number(data.workerCount || 1);

        const keyLength =
            Number(data.keyLength || 10);

        const conditions =
            Array.isArray(data.conditions)
                ? data.conditions
                : [];

        const special =
            data.special || "";

        let index =
            BigInt(workerId);

        const step =
            BigInt(workerCount);

        let count = 0;

        let lastReport =
            performance.now();

        try {

            while (running) {

                const key =
                    indexToKey(
                        index,
                        keyLength
                    );

                const trip =
                    makeTrip(
                        key,
                        keyLength
                    );

                if (
                    matchCondition(
                        trip,
                        conditions
                    ) &&
                    specialTrip(
                        trip,
                        special
                    )
                ) {

                    self.postMessage({
                        type: "hit",
                        key,
                        trip,
                        workerId
                    });
                }

                index += step;

                count++;

                /*
                 * 進捗を頻繁に送ると逆に遅くなるので
                 * 約500msごと
                 */

                const now =
                    performance.now();

                if (
                    now - lastReport >= 500
                ) {

                    self.postMessage({
                        type: "progress",
                        count,
                        workerId
                    });

                    count = 0;

                    lastReport = now;
                }
            }

        } catch (e) {

            self.postMessage({
                type: "error",
                message:
                    e && e.message
                        ? e.message
                        : String(e),
                workerId
            });
        }

        self.postMessage({
            type: "stopped",
            workerId
        });
    }

    if (data.type === "stop") {

        running = false;
    }

    if (data.type === "test") {

        try {

            if (
                typeof self.unixCryptTD !==
                "function"
            ) {
                throw new Error(
                    "unixCryptTD unavailable"
                );
            }

            const tests = [
                "aaaaaaaaaa",
                "aaaaaaaaab",
                "aaaaaaaaac",
                "aaaaaaaaad"
            ];

            const result = tests.map(
                key => ({
                    key,
                    trip: make10Trip(key)
                })
            );

            self.postMessage({
                type: "testResult",
                result
            });

        } catch (e) {

            self.postMessage({
                type: "error",
                message:
                    e.message || String(e)
            });
        }
    }

    if (data.type === "generate") {

        try {

            const key =
                String(data.key || "");

            const length =
                Number(data.keyLength || 10);

            const trip =
                makeTrip(
                    key,
                    length
                );

            self.postMessage({
                type: "generateResult",
                key,
                trip
            });

        } catch (e) {

            self.postMessage({
                type: "error",
                message:
                    e.message || String(e)
            });
        }
    }
};

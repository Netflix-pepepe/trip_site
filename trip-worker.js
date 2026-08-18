"use strict";

/*
 * =========================================================
 * 人狼オンライン トリップ検索 Worker
 *
 * 必要ファイル:
 *
 *   worker.js
 *   unix-crypt-td.min.js
 *
 * 仕様:
 *
 * 10桁:
 *   - キー先頭8文字のみ使用
 *   - 9文字目以降は無視
 *   - Unix crypt / DES
 *
 * 12桁:
 *   - 12文字キー全体を使用
 *   - SHA-1 + Base64
 *
 * =========================================================
 */

let crypt = null;
let running = false;


/* =========================================================
 * 初期化
 * ========================================================= */

try {

    importScripts("./unix-crypt-td.min.js");

    if (typeof self.unixCryptTD === "function") {

        crypt = self.unixCryptTD;

    } else if (typeof self.z === "function") {

        crypt = self.z;

    } else {

        throw new Error(
            "unixCryptTD / z が見つかりません"
        );
    }

    self.postMessage({
        type: "ready"
    });

} catch (e) {

    sendError(e);
}


/* =========================================================
 * エラー送信
 * ========================================================= */

function sendError(error) {

    let message = "Unknown worker error";

    if (error) {

        if (error.stack) {
            message = error.stack;
        } else if (error.message) {
            message = error.message;
        } else {
            message = String(error);
        }
    }

    self.postMessage({
        type: "error",
        message: message
    });
}


/* =========================================================
 * メッセージ
 * ========================================================= */

self.onmessage = function (event) {

    const data = event.data || {};

    try {

        if (data.type === "stop") {

            running = false;

            return;
        }


        if (data.type === "test") {

            runTests();

            return;
        }


        if (data.type === "generate") {

            const length =
                Number(data.length) === 12
                    ? 12
                    : 10;

            const key =
                String(data.key || "");

            const trip =
                makeTrip(
                    key,
                    length
                );

            self.postMessage({
                type: "generated",
                key: key,
                trip: trip,
                length: length
            });

            return;
        }


        if (data.type === "search") {

            if (!crypt) {

                throw new Error(
                    "unixCryptTD unavailable"
                );
            }

            running = true;

            search(data);

            return;
        }

    } catch (e) {

        running = false;

        sendError(e);
    }
};


/* =========================================================
 * トリップ生成
 * ========================================================= */

function makeTrip(key, length) {

    length =
        Number(length) === 12
            ? 12
            : 10;

    key = String(key || "");


    /*
     * =========================================
     * 10桁
     *
     * 先頭8文字のみ使用
     * =========================================
     */

    if (length === 10) {

        let shortKey =
            key.substring(0, 8);

        /*
         * 空キー対策
         */
        if (!shortKey.length) {
            shortKey = "\0";
        }


        /*
         * 2ch系10桁トリップのsalt生成。
         *
         * key + "H."
         * の2文字目・3文字目を使用。
         */

        const saltSource =
            shortKey + "H.";

        let s1 =
            saltSource.charCodeAt(1);

        let s2 =
            saltSource.charCodeAt(2);


        /*
         * salt文字変換
         */

        s1 = convertSaltCode(s1);
        s2 = convertSaltCode(s2);


        const salt =
            String.fromCharCode(s1) +
            String.fromCharCode(s2);


        /*
         * Unix crypt
         */

        const result =
            crypt(
                shortKey,
                salt
            );


        if (typeof result !== "string") {

            throw new Error(
                "unixCryptTDの戻り値が文字列ではありません"
            );
        }


        /*
         * crypt結果の末尾10文字
         *
         * saltを除いた後ろ10文字
         */

        return result.slice(-10);
    }


    /*
     * =========================================
     * 12桁
     *
     * SHA-1 + Base64
     * =========================================
     */

    if (length === 12) {

        if (!key.length) {
            key = "\0";
        }

        return sha1Trip12(key);
    }


    throw new Error(
        "不正なトリップ長: " + length
    );
}


/* =========================================================
 * 10桁 salt変換
 * ========================================================= */

function convertSaltCode(code) {

    /*
     * ASCII範囲外
     * または .～z の外側なら .
     */

    if (code >= 0x3A && code <= 0x40) {
        code += 7;
    }

    if (code >= 0x5B && code <= 0x60) {
        code += 6;
    }

    if (
        code < 0x2E ||
        code > 0x7A
    ) {
        code = 0x2E;
    }

    return code;
}


/* =========================================================
 * 12桁 SHA-1
 * ========================================================= */

function sha1Trip12(text) {

    /*
     * 今回のキー文字セットは
     * ASCII英数字・記号が中心なので
     * UTF-8で処理する。
     */

    const bytes =
        utf8Bytes(text);

    const digest =
        sha1(bytes);

    /*
     * Base64
     */

    let base64 =
        bytesToBase64(digest);


    /*
     * 2ch系12桁では
     * '+' を '.' にする
     */

    base64 =
        base64.replace(/\+/g, ".");


    /*
     * 先頭12文字
     */

    return base64.substring(0, 12);
}


/* =========================================================
 * UTF-8
 * ========================================================= */

function utf8Bytes(str) {

    const result = [];

    for (
        let i = 0;
        i < str.length;
        i++
    ) {

        let code =
            str.charCodeAt(i);


        /*
         * surrogate pair
         */

        if (
            code >= 0xD800 &&
            code <= 0xDBFF &&
            i + 1 < str.length
        ) {

            const low =
                str.charCodeAt(i + 1);

            if (
                low >= 0xDC00 &&
                low <= 0xDFFF
            ) {

                code =
                    0x10000 +
                    ((code - 0xD800) << 10) +
                    (low - 0xDC00);

                i++;
            }
        }


        if (code <= 0x7F) {

            result.push(code);

        } else if (code <= 0x7FF) {

            result.push(
                0xC0 | (code >> 6),
                0x80 | (code & 0x3F)
            );

        } else if (code <= 0xFFFF) {

            result.push(
                0xE0 | (code >> 12),
                0x80 | ((code >> 6) & 0x3F),
                0x80 | (code & 0x3F)
            );

        } else {

            result.push(
                0xF0 | (code >> 18),
                0x80 | ((code >> 12) & 0x3F),
                0x80 | ((code >> 6) & 0x3F),
                0x80 | (code & 0x3F)
            );
        }
    }

    return result;
}


/* =========================================================
 * SHA-1
 * ========================================================= */

function sha1(message) {

    const bytes =
        message.slice();

    const bitLength =
        bytes.length * 8;

    bytes.push(0x80);

    while (
        (bytes.length % 64) !== 56
    ) {
        bytes.push(0);
    }


    /*
     * 64bit length
     */

    const high =
        Math.floor(
            bitLength / 0x100000000
        );

    const low =
        bitLength >>> 0;


    bytes.push(
        (high >>> 24) & 0xFF,
        (high >>> 16) & 0xFF,
        (high >>> 8) & 0xFF,
        high & 0xFF,

        (low >>> 24) & 0xFF,
        (low >>> 16) & 0xFF,
        (low >>> 8) & 0xFF,
        low & 0xFF
    );


    let h0 = 0x67452301;
    let h1 = 0xEFCDAB89;
    let h2 = 0x98BADCFE;
    let h3 = 0x10325476;
    let h4 = 0xC3D2E1F0;


    const w =
        new Array(80);


    for (
        let offset = 0;
        offset < bytes.length;
        offset += 64
    ) {

        for (let i = 0; i < 16; i++) {

            const p =
                offset + i * 4;

            w[i] =
                (
                    (bytes[p] << 24) |
                    (bytes[p + 1] << 16) |
                    (bytes[p + 2] << 8) |
                    bytes[p + 3]
                ) >>> 0;
        }


        for (
            let i = 16;
            i < 80;
            i++
        ) {

            w[i] =
                rol(
                    w[i - 3] ^
                    w[i - 8] ^
                    w[i - 14] ^
                    w[i - 16],
                    1
                );
        }


        let a = h0;
        let b = h1;
        let c = h2;
        let d = h3;
        let e = h4;


        for (
            let i = 0;
            i < 80;
            i++
        ) {

            let f;
            let k;


            if (i < 20) {

                f =
                    (b & c) |
                    ((~b) & d);

                k =
                    0x5A827999;

            } else if (i < 40) {

                f =
                    b ^ c ^ d;

                k =
                    0x6ED9EBA1;

            } else if (i < 60) {

                f =
                    (b & c) |
                    (b & d) |
                    (c & d);

                k =
                    0x8F1BBCDC;

            } else {

                f =
                    b ^ c ^ d;

                k =
                    0xCA62C1D6;
            }


            const temp =
                (
                    rol(a, 5) +
                    f +
                    e +
                    k +
                    w[i]
                ) >>> 0;


            e = d;
            d = c;
            c = rol(b, 30);
            b = a;
            a = temp;
        }


        h0 =
            (h0 + a) >>> 0;

        h1 =
            (h1 + b) >>> 0;

        h2 =
            (h2 + c) >>> 0;

        h3 =
            (h3 + d) >>> 0;

        h4 =
            (h4 + e) >>> 0;
    }


    const output =
        new Uint8Array(20);

    write32(output, 0, h0);
    write32(output, 4, h1);
    write32(output, 8, h2);
    write32(output, 12, h3);
    write32(output, 16, h4);

    return Array.from(output);
}


/* =========================================================
 * SHA-1 utility
 * ========================================================= */

function rol(value, bits) {

    return (
        (value << bits) |
        (value >>> (32 - bits))
    ) >>> 0;
}


function write32(array, offset, value) {

    array[offset] =
        (value >>> 24) & 0xFF;

    array[offset + 1] =
        (value >>> 16) & 0xFF;

    array[offset + 2] =
        (value >>> 8) & 0xFF;

    array[offset + 3] =
        value & 0xFF;
}


/* =========================================================
 * Base64
 * ========================================================= */

function bytesToBase64(bytes) {

    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
        "abcdefghijklmnopqrstuvwxyz" +
        "0123456789+/";

    let result = "";

    for (
        let i = 0;
        i < bytes.length;
        i += 3
    ) {

        const a =
            bytes[i];

        const b =
            i + 1 < bytes.length
                ? bytes[i + 1]
                : 0;

        const c =
            i + 2 < bytes.length
                ? bytes[i + 2]
                : 0;


        result +=
            chars[a >> 2];

        result +=
            chars[
                ((a & 3) << 4) |
                (b >> 4)
            ];

        result +=
            i + 1 < bytes.length
                ? chars[
                    ((b & 15) << 2) |
                    (c >> 6)
                ]
                : "=";

        result +=
            i + 2 < bytes.length
                ? chars[c & 63]
                : "=";
    }

    return result;
}


/* =========================================================
 * 検索
 * ========================================================= */

function search(data) {

    const length =
        Number(data.length) === 12
            ? 12
            : 10;


    const conditions =
        Array.isArray(data.conditions)
            ? data.conditions
            : [];


    const special =
        data.special || "none";


    const charset =
        String(
            data.charset ||
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./!@#$%^&*()_+=[]{}?<>-"
        );


    let count = 0;


    /*
     * 10桁なら8文字
     * 12桁なら12文字
     */

    const keyLength =
        length === 10
            ? 8
            : 12;


    while (running) {

        /*
         * ランダムキー生成
         *
         * 隣接する同一文字を禁止
         */

        const key =
            randomKey(
                charset,
                keyLength
            );


        let trip;

        try {

            trip =
                makeTrip(
                    key,
                    length
                );

        } catch (e) {

            running = false;

            sendError(e);

            return;
        }


        count++;


        /*
         * 条件判定
         */

        if (
            matchesConditions(
                trip,
                conditions
            ) &&
            matchesSpecial(
                trip,
                special
            )
        ) {

            self.postMessage({
                type: "hit",
                key: key,
                trip: trip,
                length: length
            });
        }


        /*
         * 2048件ごと
         */

        if (
            (count & 2047) === 0
        ) {

            self.postMessage({
                type: "progress",
                count: 2048
            });
        }
    }


    self.postMessage({
        type: "stopped"
    });
}


/* =========================================================
 * ランダムキー
 *
 * 同じ文字を連続させない
 * ========================================================= */

function randomKey(charset, length) {

    const result = [];

    const size =
        charset.length;


    if (size < 2) {

        throw new Error(
            "文字セットには2文字以上必要です"
        );
    }


    const max =
        256 -
        (256 % size);


    let previous =
        null;


    while (
        result.length < length
    ) {

        const buffer =
            new Uint8Array(64);

        crypto.getRandomValues(
            buffer
        );


        for (
            let i = 0;
            i < buffer.length &&
            result.length < length;
            i++
        ) {

            const value =
                buffer[i];


            if (
                value >= max
            ) {
                continue;
            }


            const char =
                charset[
                    value % size
                ];


            /*
             * 同じ文字の連続を禁止
             */

            if (
                char === previous
            ) {
                continue;
            }


            result.push(char);

            previous =
                char;
        }
    }


    return result.join("");
}


/* =========================================================
 * 通常条件
 * ========================================================= */

function matchesConditions(
    trip,
    conditions
) {

    for (
        const condition
        of conditions
    ) {

        if (!condition) {
            continue;
        }


        const text =
            String(
                condition.text || ""
            );


        if (!text) {
            continue;
        }


        /*
         * 正規表現
         */

        if (condition.regex) {

            try {

                const re =
                    new RegExp(text);

                if (!re.test(trip)) {
                    return false;
                }

            } catch (e) {

                return false;
            }

            continue;
        }


        const mode =
            condition.mode ||
            "contains";


        if (
            mode === "contains" &&
            !trip.includes(text)
        ) {
            return false;
        }


        if (
            mode === "starts" &&
            !trip.startsWith(text)
        ) {
            return false;
        }


        if (
            mode === "ends" &&
            !trip.endsWith(text)
        ) {
            return false;
        }


        if (
            mode === "exact" &&
            trip !== text
        ) {
            return false;
        }
    }


    return true;
}


/* =========================================================
 * 特殊トリップ
 * ========================================================= */

function matchesSpecial(
    s,
    type
) {

    switch (type) {

        case "none":
        case "":
            return true;

        case "pure":
            return pureN(s);

        case "quasi":
            return quasiN(s);

        case "two":
            return twoKind(s);

        case "longest":
            return /^[MmW]+$/.test(s);

        case "shortest":
            return /^[li.]+$/.test(s);

        case "yakumo":
            return yakumo(s);

        case "mirror":
            return mirror(s);

        case "palindrome":
            return palindrome(s);

        case "echo":
            return echo(s);

        case "double":
            return doublePair(s);

        case "numbers":
            return numbers(s);

        case "tobiishi":
            return tobiishi(s);

        case "kakutobi":
            return kakutobi(s);

        default:
            return true;
    }
}


/* =========================================================
 * 純n連
 * ========================================================= */

function pureN(s) {

    let count = 1;


    for (
        let i = 1;
        i < s.length;
        i++
    ) {

        if (
            s[i] ===
            s[i - 1]
        ) {

            count++;


            if (
                count >= 8
            ) {
                return true;
            }

        } else {

            count = 1;
        }
    }


    return false;
}


/* =========================================================
 * 準n連
 * ========================================================= */

function quasiN(s) {

    let count = 1;


    for (
        let i = 1;
        i < s.length;
        i++
    ) {

        if (
            s[i].toLowerCase() ===
            s[i - 1].toLowerCase()
        ) {

            count++;


            if (
                count >= 9
            ) {
                return true;
            }

        } else {

            count = 1;
        }
    }


    return false;
}


/* =========================================================
 * 二構
 * ========================================================= */

function twoKind(s) {

    return new Set(s).size <= 2;
}


/* =========================================================
 * 八雲
 * ========================================================= */

function yakumo(s) {

    if (s.length < 6) {
        return false;
    }


    const groups =
        Math.floor(
            s.length / 3
        );


    if (groups < 2) {
        return false;
    }


    for (
        let i = 0;
        i < groups * 3;
        i += 3
    ) {

        if (
            s[i] !== s[i + 1] ||
            s[i] !== s[i + 2]
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================================
 * 鏡
 * ========================================================= */

function mirror(s) {

    const pair = {

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

        "i": "i",
        "l": "l",
        "o": "o",

        "p": "q",
        "q": "p",

        "v": "v",
        "w": "w"
    };


    for (
        let i = 0;
        i < s.length;
        i++
    ) {

        const left =
            s[i];

        const right =
            s[
                s.length - 1 - i
            ];


        if (
            pair[left] !== right
        ) {
            return false;
        }
    }


    return true;
}


/* =========================================================
 * 回文
 * ========================================================= */

function palindrome(s) {

    for (
        let i = 0;
        i < Math.floor(s.length / 2);
        i++
    ) {

        if (
            s[i] !==
            s[
                s.length - 1 - i
            ]
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================================
 * 山彦
 * ========================================================= */

function echo(s) {

    if (
        s.length % 2 !== 0
    ) {
        return false;
    }


    const half =
        s.length / 2;


    return (
        s.substring(0, half) ===
        s.substring(half)
    );
}


/* =========================================================
 * 双連
 * ========================================================= */

function doublePair(s) {

    if (
        s.length % 2 !== 0
    ) {
        return false;
    }


    for (
        let i = 0;
        i < s.length;
        i += 2
    ) {

        if (
            s[i] !==
            s[i + 1]
        ) {
            return false;
        }
    }


    return true;
}


/* =========================================================
 * 全数
 * ========================================================= */

function numbers(s) {

    return /^[0-9]+$/.test(s);
}


/* =========================================================
 * 飛石
 * ========================================================= */

function tobiishi(s) {

    for (
        let i = 1;
        i < s.length;
        i += 2
    ) {

        if (
            s[i] !== "." &&
            s[i] !== "/"
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================================
 * 拡飛
 * ========================================================= */

function kakutobi(s) {

    if (s.length < 2) {
        return false;
    }


    const separator =
        s[1];


    if (
        separator !== "." &&
        separator !== "/"
    ) {
        return false;
    }


    for (
        let i = 1;
        i < s.length;
        i += 2
    ) {

        if (
            s[i] !== separator
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================================
 * テスト
 * ========================================================= */

function runTests() {

    try {

        const tests = [
            {
                key: "foob",
                length: 10
            },
            {
                key: "Jim",
                length: 10
            },
            {
                key: "aaaaaaaaaa",
                length: 10
            },
            {
                key: "test",
                length: 10
            },
            {
                key: "aaaaaaaaaaaa",
                length: 12
            }
        ];


        const results =
            tests.map(function (item) {

                return {
                    key: item.key,
                    length: item.length,
                    trip: makeTrip(
                        item.key,
                        item.length
                    )
                };
            });


        self.postMessage({
            type: "test-result",
            results: results
        });


    } catch (e) {

        sendError(e);
    }
}

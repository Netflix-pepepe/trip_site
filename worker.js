"use strict";

let crypt = null;
let running = false;

/* =========================================
   初期化
========================================= */

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

    self.postMessage({
        type: "error",
        message: e && e.stack
            ? e.stack
            : String(e)
    });
}


/* =========================================
   メッセージ
========================================= */

self.onmessage = function (event) {

    const data = event.data || {};

    /* -----------------------------
       停止
    ----------------------------- */

    if (data.type === "stop") {

        running = false;

        /*
         * 停止通知は送らない。
         *
         * index.html側で terminate()
         * するため、stopping / stopped等の
         * Unknown Worker messageを発生させない。
         */

        return;
    }


    /* -----------------------------
       Test
    ----------------------------- */

    if (data.type === "test") {

        try {

            const results = [
                {
                    key: "foob",
                    trip: makeTrip("foob", 10)
                },
                {
                    key: "Jim",
                    trip: makeTrip("Jim", 10)
                },
                {
                    key: "aaaaaaaaaa",
                    trip: makeTrip("aaaaaaaaaa", 10)
                },
                {
                    key: "test",
                    trip: makeTrip("test", 10)
                }
            ];

            self.postMessage({
                type: "test-results",
                results: results
            });

        } catch (e) {

            self.postMessage({
                type: "error",
                message: e && e.stack
                    ? e.stack
                    : String(e)
            });
        }

        return;
    }


    /* -----------------------------
       Search
    ----------------------------- */

    if (data.type === "search") {

        if (typeof crypt !== "function") {

            self.postMessage({
                type: "error",
                message: "unixCryptTD unavailable"
            });

            return;
        }

        running = true;

        search(data);

        return;
    }
};


/* =========================================
   トリップ生成
========================================= */

/*
 * 10桁:
 *
 *   キーの先頭8文字のみ使用
 *   salt = key + "H." の 2,3文字目
 *   crypt()
 *   結果の末尾10文字
 *
 * 12桁:
 *
 *   キー12文字以上
 *   SHA-1
 *   Base64
 *   先頭12文字
 *
 */

function makeTrip(key, length) {

    key = String(key || "");

    if (length === 12) {
        return makeTrip12(key);
    }

    return makeTrip10(key);
}


/* =========================================
   10桁トリップ
========================================= */

function makeTrip10(key) {

    /*
     * 10桁トリップは先頭8文字だけ使用。
     */
    const usedKey =
        key.substring(0, 8);

    /*
     * 空キー対策
     */
    const workKey =
        usedKey.length > 0
            ? usedKey
            : "\0";

    /*
     * 2ch式salt生成
     *
     * key + "H."
     * の2文字目・3文字目
     */
    const saltSource =
        workKey + "H.";

    let salt1 =
        saltSource.charAt(1);

    let salt2 =
        saltSource.charAt(2);


    salt1 = normalizeSalt(salt1);
    salt2 = normalizeSalt(salt2);

    const salt =
        salt1 + salt2;


    /*
     * unix crypt
     */
    const result =
        crypt(workKey, salt);


    if (typeof result !== "string") {

        throw new Error(
            "crypt結果が文字列ではありません"
        );
    }


    /*
     * 重要:
     *
     * 先頭2文字(salt)を削るのではなく、
     * crypt結果の「末尾10文字」を使用する。
     */
    return result.slice(-10);
}


/* =========================================
   Salt変換
========================================= */

function normalizeSalt(ch) {

    if (!ch) {
        return ".";
    }

    let code =
        ch.charCodeAt(0);


    /*
     * [.-z] の範囲外は .
     */
    if (
        code < 0x2e ||
        code > 0x7a
    ) {
        return ".";
    }


    /*
     * : ; < = > ? @
     *      ↓
     * A B C D E F G
     */
    if (
        code >= 0x3a &&
        code <= 0x40
    ) {

        code += 7;
    }


    /*
     * [ \ ] ^ _ `
     *      ↓
     * a b c d e f
     */
    else if (
        code >= 0x5b &&
        code <= 0x60
    ) {

        code += 6;
    }

    return String.fromCharCode(code);
}


/* =========================================
   12桁トリップ
========================================= */

async function makeTrip12(key) {

    const data =
        new TextEncoder().encode(key);

    const hash =
        await crypto.subtle.digest(
            "SHA-1",
            data
        );

    const bytes =
        new Uint8Array(hash);

    const base64 =
        bytesToBase64(bytes);

    /*
     * 12桁
     *
     * Base64の + は .
     */
    return base64
        .substring(0, 12)
        .replace(/\+/g, ".");
}


/* =========================================
   Uint8Array → Base64
========================================= */

function bytesToBase64(bytes) {

    let binary = "";

    const chunkSize = 0x8000;

    for (
        let i = 0;
        i < bytes.length;
        i += chunkSize
    ) {

        const chunk =
            bytes.subarray(
                i,
                Math.min(
                    i + chunkSize,
                    bytes.length
                )
            );

        binary +=
            String.fromCharCode.apply(
                null,
                chunk
            );
    }

    return btoa(binary);
}


/* =========================================
   検索
========================================= */

async function search(data) {

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
        data.charset ||
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./!@#$%^&*()_+-=[]{}<>?";


    /*
     * 10桁:
     *   検索キーは実際に使用される8文字
     *
     * 12桁:
     *   12文字すべて使用
     */
    const keyLength =
        length === 10
            ? 8
            : 12;


    let count = 0;


    while (running) {

        /*
         * ランダムキー
         *
         * 隣接する同じ文字を禁止。
         */
        const key =
            randomKey(
                charset,
                keyLength
            );


        let trip;


        try {

            trip =
                await makeTrip(
                    key,
                    length
                );

        } catch (e) {

            self.postMessage({
                type: "error",
                message: e && e.stack
                    ? e.stack
                    : String(e)
            });

            running = false;

            return;
        }


        if (!running) {
            return;
        }


        count++;


        /*
         * 10桁の場合:
         *
         * 最終2文字を検索判定から除外。
         *
         * 12桁の場合:
         *
         * 12文字全部判定。
         */
        const compareTrip =
            length === 10
                ? trip.substring(0, 8)
                : trip;


        /*
         * 条件判定
         */
        if (
            matchesConditions(
                compareTrip,
                conditions
            ) &&
            matchesSpecial(
                compareTrip,
                special
            )
        ) {

            self.postMessage({
                type: "hit",
                key: key,
                trip: trip
            });
        }


        /*
         * 2048件ごとに進捗
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
}


/* =========================================
   ランダムキー
========================================= */

/*
 * 隣接同一文字なし。
 *
 * 例:
 *
 * NG:
 *   aaaaaaaaa
 *   aaA
 *   11
 *
 * OK:
 *   aB7@x!2Q
 *   !fa4K{0
 *
 */

function randomKey(charset, length) {

    const result = [];

    const size =
        charset.length;


    if (size < 2) {

        throw new Error(
            "charsetには最低2種類の文字が必要です"
        );
    }


    while (
        result.length < length
    ) {

        const buffer =
            new Uint8Array(64);

        crypto.getRandomValues(
            buffer
        );


        /*
         * rejection sampling
         */
        const max =
            256 -
            (256 % size);


        for (
            let i = 0;
            i < buffer.length &&
            result.length < length;
            i++
        ) {

            const value =
                buffer[i];


            if (value >= max) {
                continue;
            }


            const ch =
                charset[
                    value % size
                ];


            /*
             * 前の文字と同じなら捨てる。
             */
            if (
                result.length > 0 &&
                result[
                    result.length - 1
                ] === ch
            ) {
                continue;
            }


            result.push(ch);
        }
    }


    return result.join("");
}


/* =========================================
   通常条件
========================================= */

function matchesConditions(
    trip,
    conditions
) {

    for (
        const condition of conditions
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


/* =========================================
   特殊トリップ
========================================= */

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
            return /^[0-9]+$/.test(s);

        case "tobiishi":
            return tobiishi(s);

        case "kakutobi":
            return kakutobi(s);

        default:
            return true;
    }
}


/* =========================================
   純n連
========================================= */

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

            if (count >= 8) {
                return true;
            }

        } else {

            count = 1;
        }
    }

    return false;
}


/* =========================================
   準n連
========================================= */

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

            if (count >= 9) {
                return true;
            }

        } else {

            count = 1;
        }
    }

    return false;
}


/* =========================================
   二構
========================================= */

function twoKind(s) {

    return new Set(s).size <= 2;
}


/* =========================================
   八雲
========================================= */

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


/* =========================================
   鏡
========================================= */

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
                s.length -
                1 -
                i
            ];


        if (
            pair[left] !== right
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   回文
========================================= */

function palindrome(s) {

    for (
        let i = 0;
        i < Math.floor(
            s.length / 2
        );
        i++
    ) {

        if (
            s[i] !==
            s[
                s.length -
                1 -
                i
            ]
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   山彦
========================================= */

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


/* =========================================
   双連
========================================= */

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


/* =========================================
   全数
========================================= */

function numbers(s) {

    return /^[0-9]+$/.test(s);
}


/* =========================================
   飛石
========================================= */

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


/* =========================================
   拡飛
========================================= */

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

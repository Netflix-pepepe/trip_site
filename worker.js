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
        throw new Error("unixCryptTD が見つかりません");
    }

    self.postMessage({
        type: "ready"
    });

} catch (e) {

    self.postMessage({
        type: "error",
        message: e && e.stack ? e.stack : String(e)
    });
}


/* =========================================
   メッセージ
========================================= */

self.onmessage = function (event) {

    const data = event.data || {};

    if (data.type === "stop") {
        running = false;

        self.postMessage({
            type: "stopped"
        });

        return;
    }

    if (data.type === "test") {

        if (typeof crypt !== "function") {
            self.postMessage({
                type: "error",
                message: "crypt is not a function"
            });
            return;
        }

        try {

            const tests = [
                "foob",
                "Jim",
                "aaaaaaaaaa",
                "test"
            ];

            const results = tests.map(function (key) {

                const result = makeTrip(key, 12);

                return {
                    key: key,
                    trip: result.trip,
                    displayKey: result.displayKey
                };
            });

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

    if (data.type === "generate") {

        if (typeof crypt !== "function") {
            self.postMessage({
                type: "error",
                message: "unixCryptTD unavailable"
            });
            return;
        }

        try {

            const length =
                Number(data.length) === 12
                    ? 12
                    : 10;

            const key =
                String(data.key || "");

            const result =
                makeTrip(key, length);

            self.postMessage({
                type: "generated",
                key: key,
                trip: result.trip,
                displayKey: result.displayKey
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
   Trip生成
========================================= */

/*
 * 重要
 *
 * 10桁:
 *   実際のcryptには先頭8文字だけ渡す。
 *   表示キーは # + 8文字 + ..
 *
 * 12桁:
 *   cryptには入力されたキーを渡す。
 *   Tripは12文字取得する。
 *
 * crypt自体がDES cryptなので、
 * 実質的なDESキー部分は先頭8文字。
 */

function makeTrip(inputKey, length) {

    if (typeof crypt !== "function") {
        throw new Error("unixCryptTD unavailable");
    }

    length =
        Number(length) === 12
            ? 12
            : 10;

    let original =
        String(inputKey == null ? "" : inputKey);

    /*
     * 画面から #xxxxxxxx.. が戻ってきても
     * 実キーとして扱えるようにする。
     */
    if (
        length === 10 &&
        original.charAt(0) === "#" &&
        original.endsWith("..")
    ) {
        original =
            original.substring(
                1,
                original.length - 2
            );
    }

    if (!original) {
        throw new Error("トリップキーが空です");
    }

    /*
     * 10桁は8文字キー。
     */
    let actualKey;

    if (length === 10) {
        actualKey =
            original.substring(0, 8);

        if (actualKey.length < 8) {
            throw new Error(
                "10桁トリップには8文字のキーが必要です"
            );
        }
    } else {
        /*
         * 12桁は12文字入力を受け付ける。
         *
         * unix crypt内部ではDESキーとして
         * 先頭8文字が使用されるが、
         * Trip出力は12文字取得する。
         */
        actualKey =
            original.substring(0, 12);

        if (actualKey.length < 2) {
            throw new Error(
                "12桁トリップキーが短すぎます"
            );
        }
    }

    /*
     * unix cryptのsaltは先頭2文字。
     */
    let salt =
        actualKey.substring(0, 2);

    if (salt.length < 2) {
        salt =
            (salt + "AA").substring(0, 2);
    }

    const result =
        crypt(actualKey, salt);

    if (typeof result !== "string") {
        throw new Error(
            "crypt結果が文字列ではありません"
        );
    }

    /*
     * Unix crypt:
     *
     * 先頭2文字 = salt
     * それ以降 = Trip本体
     */
    const trip =
        result.substring(
            2,
            2 + length
        );

    /*
     * 画面表示用キー
     */
    let displayKey;

    if (length === 10) {

        displayKey =
            "#" +
            actualKey +
            "..";

    } else {

        displayKey =
            actualKey;
    }

    return {
        trip: trip,
        displayKey: displayKey,
        actualKey: actualKey
    };
}


/* =========================================
   検索
========================================= */

function search(data) {

    /*
     * 10桁検索:
     *
     * Tripは10文字だが、キーは8文字。
     *
     * 12桁検索:
     *
     * 12文字キーを生成し、
     * Tripを12文字取得。
     */
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
     * 10桁なら8文字キー。
     * 12桁なら12文字キー。
     */
    const keyLength =
        length === 10
            ? 8
            : 12;

    let count = 0;

    while (running) {

        /*
         * ランダムキー生成
         *
         * 同じ文字が連続しないようにする。
         */
        const key =
            randomKey(
                charset,
                keyLength
            );

        let result;

        try {

            result =
                makeTrip(
                    key,
                    length
                );

        } catch (e) {

            self.postMessage({
                type: "error",
                message: e && e.message
                    ? e.message
                    : String(e)
            });

            running = false;
            return;
        }

        const trip =
            result.trip;

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
                key: result.actualKey,
                displayKey: result.displayKey,
                trip: trip
            });
        }

        /*
         * 2048回ごとに進捗
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


/* =========================================
   ランダムキー
========================================= */

function randomKey(charset, length) {

    const result = [];

    const size =
        charset.length;

    if (size < 2) {
        throw new Error(
            "charsetが短すぎます"
        );
    }

    /*
     * 256の偏りを避ける
     */
    const max =
        256 -
        (256 % size);

    let previous = "";

    while (
        result.length < length
    ) {

        const buffer =
            new Uint8Array(64);

        crypto.getRandomValues(buffer);

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

            const char =
                charset[
                    value % size
                ];

            /*
             * 同じ文字を連続させない
             */
            if (
                char === previous
            ) {
                continue;
            }

            result.push(char);

            previous = char;
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

    for (const condition of conditions) {

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
            return numbers(s);

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

        if (s[i] === s[i - 1]) {

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
        Math.floor(s.length / 3);

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


/* =========================================
   回文
========================================= */

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

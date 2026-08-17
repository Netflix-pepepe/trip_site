"use strict";

/*
 * trip-worker.js
 *
 * ・Worker内でunix-crypt-tdを読み込む
 * ・ランダムな10/12文字キーを生成
 * ・同じキーを生成しない
 * ・Workerごとの重複を防ぐ
 */

let crypt = null;

self.onmessage = function (e) {

    const data = e.data || {};

    /* =========================================
       初期化
    ========================================= */

    if (data.type === "init") {

        try {

            importScripts("./unix-crypt-td.min.js");

            if (typeof self.unixCryptTD === "function") {
                crypt = self.unixCryptTD;
            }

            if (typeof crypt !== "function") {
                throw new Error(
                    "unixCryptTD unavailable"
                );
            }

            self.postMessage({
                type: "ready"
            });

        } catch (err) {

            self.postMessage({
                type: "error",
                message: err.message || String(err)
            });
        }

        return;
    }


    /* =========================================
       検索
    ========================================= */

    if (data.type === "search") {

        if (typeof crypt !== "function") {

            self.postMessage({
                type: "error",
                message: "unixCryptTD unavailable"
            });

            return;
        }

        search(data);

        return;
    }


    /* =========================================
       単発生成
    ========================================= */

    if (data.type === "generate") {

        try {

            const key = String(data.key || "");

            const trip = makeTrip(key);

            self.postMessage({
                type: "generated",
                key: key,
                trip: trip
            });

        } catch (err) {

            self.postMessage({
                type: "error",
                message: err.message || String(err)
            });
        }
    }
};


/* =========================================
   Trip生成
========================================= */

function makeTrip(key) {

    if (!key) {
        throw new Error("キーが空です");
    }

    /*
     * Unix cryptのsalt
     *
     * 2文字を使用
     */
    const salt = key.slice(0, 2);

    const result = crypt(key, salt);

    if (typeof result !== "string") {
        throw new Error("Trip生成失敗");
    }

    /*
     * 通常のTrip部分だけ返す
     *
     * crypt結果:
     * xxXXXXXXXXXXX
     *
     * 先頭2文字はsalt
     */
    return result.slice(2);
}


/* =========================================
   ランダムキー検索
========================================= */

function search(data) {

    const length = Number(data.length) === 12
        ? 12
        : 10;

    const charset =
        data.charset ||
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./";

    const conditions =
        Array.isArray(data.conditions)
            ? data.conditions
            : [];

    const special =
        data.special || "none";


    let count = 0;

    /*
     * 同じWorker内で同じキーを出さない
     */
    const usedKeys = new Set();

    /*
     * 乱数で永遠に検索
     */
    while (true) {

        const key = randomKey(
            charset,
            length
        );

        if (usedKeys.has(key)) {
            continue;
        }

        usedKeys.add(key);

        const trip = makeTrip(key);

        count++;

        /*
         * 条件チェック
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
                trip: trip
            });
        }


        /*
         * まとめて進捗送信
         */
        if ((count & 1023) === 0) {

            self.postMessage({
                type: "progress",
                count: 1024
            });
        }
    }
}


/* =========================================
   暗号学的乱数
========================================= */

function randomKey(charset, length) {

    const result = [];

    /*
     * rejection sampling
     *
     * 文字コード範囲の偏りを避ける
     */
    const max = 256 -
        (256 % charset.length);

    while (result.length < length) {

        const buf =
            new Uint8Array(32);

        crypto.getRandomValues(buf);

        for (let i = 0;
             i < buf.length &&
             result.length < length;
             i++) {

            const n = buf[i];

            if (n >= max) {
                continue;
            }

            result.push(
                charset[n % charset.length]
            );
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

    for (const c of conditions) {

        const text =
            String(c.text || "");

        if (!text) {
            continue;
        }

        /*
         * 正規表現
         */
        if (c.regex) {

            try {

                const re =
                    new RegExp(text);

                if (!re.test(trip)) {
                    return false;
                }

            } catch {

                return false;
            }

            continue;
        }


        const mode =
            c.mode || "contains";


        if (mode === "starts") {

            if (!trip.startsWith(text)) {
                return false;
            }

        } else if (mode === "ends") {

            if (!trip.endsWith(text)) {
                return false;
            }

        } else if (mode === "exact") {

            if (trip !== text) {
                return false;
            }

        } else {

            if (!trip.includes(text)) {
                return false;
            }
        }
    }

    return true;
}


/* =========================================
   特殊Trip
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
            return hasRun(
                s,
                8,
                false
            );

        case "quasi":
            return hasRun(
                s,
                9,
                true
            );

        case "two":
            return new Set(
                s.split("")
            ).size <= 2;

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
   純連 / 準連
========================================= */

function hasRun(
    s,
    min,
    ignoreCase
) {

    if (!s.length) {
        return false;
    }

    let last =
        ignoreCase
            ? s[0].toLowerCase()
            : s[0];

    let n = 1;

    for (
        let i = 1;
        i < s.length;
        i++
    ) {

        const c =
            ignoreCase
                ? s[i].toLowerCase()
                : s[i];

        if (c === last) {

            n++;

            if (n >= min) {
                return true;
            }

        } else {

            last = c;
            n = 1;
        }
    }

    return false;
}


/* =========================================
   八雲
========================================= */

function yakumo(s) {

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

        if (
            pair[s[i]] !==
            s[s.length - 1 - i]
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
        i < s.length / 2;
        i++
    ) {

        if (
            s[i] !==
            s[s.length - 1 - i]
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

    if (s.length % 2 !== 0) {
        return false;
    }

    const half =
        s.length / 2;

    return (
        s.slice(0, half) ===
        s.slice(half)
    );
}


/* =========================================
   双連
========================================= */

function doublePair(s) {

    if (s.length % 2 !== 0) {
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

    const separator = s[1];

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

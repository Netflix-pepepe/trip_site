"use strict";

let crypt = null;

self.onmessage = function (e) {

    const data = e.data || {};

    if (data.type === "init") {

        try {

            // ライブラリ読み込み
            importScripts("./unix-crypt-td.min.js");

            /*
             * unix-crypt-td.min.js は Worker では
             * window.unixCryptTD を作らない。
             *
             * 貼ってくれたライブラリでは
             * 内部の関数が var z として存在するので、
             * Workerでは self.z を取得する。
             */
            if (typeof self.unixCryptTD === "function") {
                crypt = self.unixCryptTD;
            }
            else if (typeof self.z === "function") {
                crypt = self.z;
            }
            else {
                throw new Error(
                    "unixCryptTD / z が見つかりません"
                );
            }

            self.postMessage({
                type: "ready"
            });

        } catch (err) {

            self.postMessage({
                type: "error",
                message: String(
                    err && err.message
                        ? err.message
                        : err
                )
            });
        }

        return;
    }

    if (data.type === "generate") {

        try {

            if (typeof crypt !== "function") {
                throw new Error(
                    "crypt is not a function"
                );
            }

            const key =
                String(data.key || "");

            const salt =
                key.slice(0, 2);

            const result =
                crypt(key, salt);

            if (
                typeof result !== "string"
            ) {
                throw new Error(
                    "Trip生成結果が文字列ではありません"
                );
            }

            self.postMessage({
                type: "generated",
                key: key,
                trip: result.slice(2)
            });

        } catch (err) {

            self.postMessage({
                type: "error",
                message: String(
                    err && err.message
                        ? err.message
                        : err
                )
            });
        }

        return;
    }

    if (data.type === "search") {

        try {

            if (typeof crypt !== "function") {
                throw new Error(
                    "crypt is not a function"
                );
            }

            search(data);

        } catch (err) {

            self.postMessage({
                type: "error",
                message: String(
                    err && err.message
                        ? err.message
                        : err
                )
            });
        }

        return;
    }
};


/* ================================
   Trip生成
================================ */

function makeTrip(key) {

    if (typeof crypt !== "function") {
        throw new Error(
            "crypt is not a function"
        );
    }

    const salt =
        key.slice(0, 2);

    const result =
        crypt(key, salt);

    if (
        typeof result !== "string"
    ) {
        throw new Error(
            "Trip生成失敗"
        );
    }

    return result.slice(2);
}


/* ================================
   検索
================================ */

function search(data) {

    const length =
        Number(data.length) === 12
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

    const usedKeys =
        new Set();

    while (true) {

        const key =
            randomKey(
                charset,
                length
            );

        if (usedKeys.has(key)) {
            continue;
        }

        usedKeys.add(key);

        const trip =
            makeTrip(key);

        count++;

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

        if (
            (count & 1023) === 0
        ) {

            self.postMessage({
                type: "progress",
                count: 1024
            });
        }
    }
}


/* ================================
   ランダムキー
================================ */

function randomKey(
    charset,
    length
) {

    const result = [];

    const max =
        256 -
        (256 % charset.length);

    while (
        result.length < length
    ) {

        const buf =
            new Uint8Array(32);

        crypto.getRandomValues(buf);

        for (
            let i = 0;
            i < buf.length &&
            result.length < length;
            i++
        ) {

            const n = buf[i];

            if (n >= max) {
                continue;
            }

            result.push(
                charset[
                    n % charset.length
                ]
            );
        }
    }

    return result.join("");
}


/* ================================
   通常条件
================================ */

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

        if (
            mode === "contains" &&
            !trip.includes(text)
        ) {
            return false;
        }
    }

    return true;
}


/* ================================
   特殊Trip
================================ */

function matchesSpecial(
    s,
    type
) {

    switch (type) {

        case "none":
        case "":
            return true;

        case "pure":
            return hasRun(s, 8, false);

        case "quasi":
            return hasRun(s, 9, true);

        case "two":
            return new Set(s).size <= 2;

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
            s[i] !== s[i + 1]
        ) {
            return false;
        }
    }

    return true;
}


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


function kakutobi(s) {

    if (s.length < 2) {
        return false;
    }

    const separator =
        s[1];

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

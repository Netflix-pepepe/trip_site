"use strict";

let cryptReady = false;

try {
    importScripts("./unix-crypt-td.min.js");

    if (typeof unixCryptTD === "function") {
        cryptReady = true;
        postMessage({ type: "ready" });
    } else {
        throw new Error("unixCryptTD が定義されていません");
    }
} catch (e) {
    postMessage({
        type: "error",
        message: "unix-crypt-td.min.js 読み込み失敗: " + e.message
    });
}


/* =========================
   Trip
========================= */

function saltForTrip(key) {
    let s = (key + "H.").slice(1, 3);

    s = s.replace(/[^\.-z]/g, ".");

    s = s.replace(/[\:;<=>?@[\\\]^_`]/g, c => {
        const table = {
            ":":"A",
            ";":"B",
            "<":"C",
            "=":"D",
            ">":"E",
            "?":"F",
            "@":"G",
            "[":"a",
            "\\":"b",
            "]":"c",
            "^":"d",
            "_":"e",
            "`":"f"
        };

        return table[c] || c;
    });

    return s;
}


function makeTrip(key) {

    if (!cryptReady) {
        throw new Error("unixCryptTD unavailable");
    }

    return "◆" +
        unixCryptTD(
            key,
            saltForTrip(key)
        ).slice(-10);
}


/* =========================
   Special Trip
========================= */

function pureN(t) {

    let max = 1;
    let n = 1;

    for (let i = 1; i < t.length; i++) {

        if (t[i] === t[i - 1]) {
            n++;
            if (n > max) max = n;
        } else {
            n = 1;
        }
    }

    return max;
}


function quasiN(t) {

    let max = 1;
    let n = 1;

    for (let i = 1; i < t.length; i++) {

        if (
            t[i].toLowerCase() ===
            t[i - 1].toLowerCase()
        ) {
            n++;
            if (n > max) max = n;
        } else {
            n = 1;
        }
    }

    return max;
}


function isTwoStructure(t) {
    return new Set(t).size <= 2;
}


function isLongest(t) {
    return /^[MmW]+$/.test(t);
}


function isShortest(t) {
    return /^[li.]+$/.test(t);
}


function isYakumo(t) {

    const usable =
        t.length - (t.length % 3);

    if (usable < 3) {
        return false;
    }

    for (let i = 0; i < usable; i += 3) {

        if (
            t[i] !== t[i + 1] ||
            t[i] !== t[i + 2]
        ) {
            return false;
        }
    }

    return true;
}


function isMirror(t) {

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

        "a": "a",
        "b": "d",
        "d": "b",

        "i": "i",
        "l": "l",

        "o": "o",
        "p": "q",
        "q": "p",
        "v": "v",
        "w": "w",
        "x": "x"
    };

    for (
        let i = 0;
        i < Math.floor(t.length / 2);
        i++
    ) {

        if (
            pair[t[i]] !==
            t[t.length - 1 - i]
        ) {
            return false;
        }
    }

    return true;
}


function isPalindrome(t) {

    for (
        let i = 0;
        i < Math.floor(t.length / 2);
        i++
    ) {

        if (
            t[i] !==
            t[t.length - 1 - i]
        ) {
            return false;
        }
    }

    return true;
}


function isEcho(t) {

    if (t.length % 2 !== 0) {
        return false;
    }

    const half = t.length / 2;

    return (
        t.slice(0, half) ===
        t.slice(half)
    );
}


function isDouble(t) {

    if (t.length % 2 !== 0) {
        return false;
    }

    for (let i = 0; i < t.length; i += 2) {

        if (t[i] !== t[i + 1]) {
            return false;
        }
    }

    return true;
}


function isNumber(t) {
    return /^[0-9]+$/.test(t);
}


function isTobiishi(t) {

    for (let i = 1; i < t.length; i += 2) {

        if (
            t[i] !== "." &&
            t[i] !== "/"
        ) {
            return false;
        }
    }

    return true;
}


function isKakutobi(t) {

    if (t.length < 3) {
        return false;
    }

    const separator = t[1];

    for (let i = 1; i < t.length; i += 2) {

        if (t[i] !== separator) {
            return false;
        }
    }

    return true;
}


function specialMatch(t, type) {

    switch (type) {

        case "pure":
            return pureN(t) >= 8;

        case "quasi":
            return quasiN(t) >= 9;

        case "two":
            return isTwoStructure(t);

        case "longest":
            return isLongest(t);

        case "shortest":
            return isShortest(t);

        case "yakumo":
            return isYakumo(t);

        case "mirror":
            return isMirror(t);

        case "palindrome":
            return isPalindrome(t);

        case "echo":
            return isEcho(t);

        case "double":
            return isDouble(t);

        case "number":
            return isNumber(t);

        case "tobiishi":
            return isTobiishi(t);

        case "kakutobi":
            return isKakutobi(t);

        default:
            return true;
    }
}


/* =========================
   Regex / Normal
========================= */

function matchNormal(t, conditions) {

    for (const c of conditions) {

        const text = c.text;

        if (!text) {
            continue;
        }

        if (c.regex) {

            let re;

            try {
                re = new RegExp(text);
            } catch {
                return false;
            }

            if (!re.test(t)) {
                return false;
            }

            continue;
        }


        if (c.mode === "prefix") {

            if (!t.startsWith(text)) {
                return false;
            }

        } else if (c.mode === "suffix") {

            if (!t.endsWith(text)) {
                return false;
            }

        } else if (c.mode === "exact") {

            if (t !== text) {
                return false;
            }

        } else {

            if (!t.includes(text)) {
                return false;
            }
        }
    }

    return true;
}


/* =========================
   Fast candidate filtering
========================= */

function allowedCharsForSpecial(type) {

    switch (type) {

        case "longest":
            return "MmW";

        case "shortest":
            return "li.";

        case "number":
            return "0123456789";

        default:
            return null;
    }
}


/* =========================
   Index → Key
========================= */

function keyFromIndex(
    index,
    chars,
    length
) {

    let out = "";

    for (
        let i = 0;
        i < length;
        i++
    ) {

        out =
            chars[index % chars.length] +
            out;

        index =
            Math.floor(
                index / chars.length
            );
    }

    return out;
}


/* =========================
   Worker state
========================= */

let stopped = false;

self.onmessage = function(e) {

    const data = e.data;

    if (data.cmd === "stop") {

        stopped = true;

        return;
    }

    if (data.cmd !== "start") {
        return;
    }

    if (!cryptReady) {

        postMessage({
            type: "error",
            message: "unixCryptTD unavailable"
        });

        return;
    }

    stopped = false;


    let chars = data.chars;

    const special =
        data.special || "none";


    /*
     * 特殊トリップによって
     * 候補文字を制限
     */

    const specialChars =
        allowedCharsForSpecial(
            special
        );

    if (specialChars) {
        chars = specialChars;
    }


    const length =
        data.length;

    const workerId =
        data.workerId;

    const workerCount =
        data.workerCount;

    const conditions =
        data.conditions || [];

    const unlimited =
        data.unlimited === true;

    const maxAttempts =
        Number(data.maxAttempts);


    const total =
        Math.pow(
            chars.length,
            length
        );


    /*
     * Workerごとに
     *
     * workerId,
     * workerId + workerCount,
     * ...
     *
     * と分割。
     */

    let index =
        workerId;


    let attempts = 0;
    let found = 0;

    const started =
        performance.now();


    while (
        !stopped
    ) {

        if (
            !unlimited &&
            attempts >= maxAttempts
        ) {
            break;
        }

        /*
         * 全探索終了
         */

        if (
            index >= total
        ) {
            break;
        }


        const key =
            keyFromIndex(
                index,
                chars,
                length
            );


        let trip;

        try {

            trip =
                makeTrip(key);

        } catch (err) {

            postMessage({
                type: "error",
                message: err.message
            });

            return;
        }


        attempts++;


        const t =
            trip.slice(1);


        /*
         * 通常条件
         */

        if (
            !matchNormal(
                t,
                conditions
            )
        ) {

            index += workerCount;
            continue;
        }


        /*
         * 特殊条件
         */

        if (
            special !== "none" &&
            !specialMatch(
                t,
                special
            )
        ) {

            index += workerCount;
            continue;
        }


        found++;


        postMessage({
            type: "hit",
            worker: workerId,
            key: key,
            trip: trip
        });


        index += workerCount;


        /*
         * 進捗通知を減らす
         */

        if (
            attempts % 5000 === 0
        ) {

            const seconds =
                (performance.now() -
                    started) / 1000;

            const rate =
                Math.round(
                    attempts /
                    Math.max(
                        seconds,
                        0.001
                    )
                );

            postMessage({
                type: "progress",
                worker: workerId,
                attempts: attempts,
                rate: rate,
                found: found
            });
        }
    }


    const seconds =
        (performance.now() -
            started) / 1000;

    const rate =
        Math.round(
            attempts /
            Math.max(
                seconds,
                0.001
            )
        );


    postMessage({
        type: "done",
        worker: workerId,
        attempts: attempts,
        rate: rate,
        found: found,
        stopped: stopped
    });
};

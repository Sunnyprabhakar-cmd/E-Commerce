import db from "../database/database.js";

const normalizeAmount = (amount) => {
    const value = Number(amount);
    if (Number.isNaN(value) || value <= 0) {
        return null;
    }
    return value;
};

const ensure_wallet = async (user_id) => {
    const existing = await db.query("SELECT wallet_id,user_id,balance FROM wallets WHERE user_id=$1 LIMIT 1", [user_id]);
    if (existing.rows.length > 0) {
        return existing.rows[0];
    }

    const created = await db.query(
        "INSERT INTO wallets(user_id,balance) VALUES ($1,$2) RETURNING wallet_id,user_id,balance",
        [user_id, 0]
    );
    return created.rows[0];
};

const recordTransactionIfPossible = async (
    wallet_id,
    type,
    amount,
    balance_before,
    balance_after,
    reference_id,
    reference_type,
    description
) => {
    try {
        await db.query(
            "INSERT INTO wallet_transactions(wallet_id,type,amount,balance_before,balance_after,reference_id,reference_type,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
            [wallet_id, type, amount, balance_before, balance_after, reference_id || null, reference_type || null, description || null]
        );
    } catch (_err) {
        
    }
};

export const create_wallet = async (user_id) => {
    try {
        if (!user_id) {
            return { ok: false, message: "Invalid user" };
        }
        const wallet = await ensure_wallet(user_id);
        return { ok: true, message: "wallet ready", wallet };
    } catch (err) {
        return { ok: false, message: "error occured while creating wallet", error: err.message };
    }
};

export const wallet_details = async (user_id) => {
    try {
        if (!user_id) {
            return { ok: false, message: "Invalid user" };
        }
        const wallet = await ensure_wallet(user_id);
        return { ok: true, message: "wallet details fetched", wallet };
    } catch (err) {
        return { ok: false, message: "error occured while fetching wallet details", error: err.message };
    }
};

export const balance_check = async (user_id) => {
    try {
        const detail = await wallet_details(user_id);
        if (!detail.ok) {
            return detail;
        }
        return { ok: true, message: "balance fetched", balance: Number(detail.wallet.balance || 0) };
    } catch (err) {
        return { ok: false, message: "some error occured", error: err.message };
    }
};

export const add_balance = async (user_id, amount, type, reference_type, description, reference_id) => {
    try {
        if (!user_id) {
            return { ok: false, message: "Invalid user" };
        }
        const amt = normalizeAmount(amount);
        if (!amt) {
            return { ok: false, message: "Invalid amount" };
        }

        const detail = await wallet_details(user_id);
        if (!detail.ok) {
            return detail;
        }

        const balance_before = Number(detail.wallet.balance || 0);
        const balance_after = balance_before + amt;

        await db.query("UPDATE wallets SET balance=$1 WHERE wallet_id=$2", [balance_after, detail.wallet.wallet_id]);
        await recordTransactionIfPossible(
            detail.wallet.wallet_id,
            type || "credit",
            amt,
            balance_before,
            balance_after,
            reference_id,
            reference_type,
            description
        );

        return { ok: true, message: "balance credited", balance: balance_after };
    } catch (err) {
        return { ok: false, message: "error occured while adding balance", error: err.message };
    }
};

export const diduct_balance = async (user_id, amount, type, reference_type, description, reference_id) => {
    try {
        if (!user_id) {
            return { ok: false, message: "Invalid user" };
        }
        const amt = normalizeAmount(amount);
        if (!amt) {
            return { ok: false, message: "Invalid amount" };
        }

        const detail = await wallet_details(user_id);
        if (!detail.ok) {
            return detail;
        }

        const balance_before = Number(detail.wallet.balance || 0);
        if (balance_before < amt) {
            return { ok: false, message: "insufficient balance", balance: balance_before };
        }

        const balance_after = balance_before - amt;
        await db.query("UPDATE wallets SET balance=$1 WHERE wallet_id=$2", [balance_after, detail.wallet.wallet_id]);
        await recordTransactionIfPossible(
            detail.wallet.wallet_id,
            type || "debit",
            amt,
            balance_before,
            balance_after,
            reference_id,
            reference_type,
            description
        );

        return { ok: true, message: "balance debited", balance: balance_after };
    } catch (err) {
        return { ok: false, message: "error occured while deducting balance", error: err.message };
    }
};
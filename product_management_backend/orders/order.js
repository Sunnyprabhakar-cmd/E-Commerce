import db from "../database/database.js";

let isOrderSchemaReady = false;

const ensureOrderSchema = async () => {
    if (isOrderSchemaReady) {
        return;
    }
    // Existing DB uses integer product_id while app product IDs are UUID strings.
    await db.query("ALTER TABLE orders ALTER COLUMN product_id TYPE text USING product_id::text");
    await db.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT TRUE");
    await db.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'placed'");
    await db.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_mode TEXT");
    await db.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT");
    await db.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_notes TEXT");
    await db.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_group_id TEXT");
    await db.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0");
    await db.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC DEFAULT 0");
    await db.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC DEFAULT 0");
    await db.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0");
    await db.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payable_amount NUMERIC DEFAULT 0");
    await db.query(`
        CREATE TABLE IF NOT EXISTS order_actions (
            action_id SERIAL PRIMARY KEY,
            order_id INTEGER NOT NULL,
            action_by_user_id TEXT,
            action_by_user_name TEXT,
            action_by_user_phone TEXT,
            action_by_role TEXT,
            action_type TEXT NOT NULL,
            action_note TEXT,
            action_metadata TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);
    await db.query("ALTER TABLE order_actions ADD COLUMN IF NOT EXISTS action_by_user_name TEXT");
    await db.query("ALTER TABLE order_actions ADD COLUMN IF NOT EXISTS action_by_user_phone TEXT");
    await db.query("ALTER TABLE order_actions ADD COLUMN IF NOT EXISTS action_metadata TEXT");
    isOrderSchemaReady = true;
};

const recordOrderAction = async (
    orderId,
    actionByUserId,
    actionByUserName,
    actionByUserPhone,
    actionByRole,
    actionType,
    actionNote = null,
    actionMetadata = null
) => {
    try {
        await db.query(
            "INSERT INTO order_actions(order_id, action_by_user_id, action_by_user_name, action_by_user_phone, action_by_role, action_type, action_note, action_metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
            [orderId, actionByUserId, actionByUserName, actionByUserPhone, actionByRole, actionType, actionNote, actionMetadata]
        );
    } catch (err) {
        console.error("Failed to record order action", err.message);
    }
};

export const placeOrder = async (
    product_id,
    user_id,
    order_group_id = null,
    quantity,
    product_price,
    is_paid = true,
    payment_mode = null,
    payment_reference = null,
    payment_notes = null
) => {
    try {
        if (!product_id || !user_id || !quantity || !product_price) {
            return { message: "Invalid parameters try again" };
        }
        await ensureOrderSchema();
        const pid = String(product_id);
        const qty = Number(quantity);
        const unitPrice = Number(product_price);
        if (Number.isNaN(qty) || qty <= 0 || Number.isNaN(unitPrice) || unitPrice <= 0) {
            return { message: "Invalid quantity or product price" };
        }
        const total_cost = qty * unitPrice;
        const discount_percentage = 0;
        const discount_amount = 0;
        const payable_amount = total_cost - discount_amount;
        const amount_paid = is_paid ? payable_amount : 0;
        const remaining_amount = payable_amount - amount_paid;
        const status = is_paid ? 'paid' : 'pending';
        const final_payment_mode = is_paid ? (payment_mode || 'wallet') : payment_mode;
        const final_payment_reference = is_paid ? (payment_reference || 'wallet debit') : payment_reference;
        const final_payment_notes = is_paid
            ? (payment_notes || 'Paid with wallet during order placement')
            : (payment_notes || 'Order created with deferred payment');

        try {
            const created = await db.query(
                "INSERT INTO orders(product_id,user_id,order_group_id,quantity,product_price,total_cost,discount_percentage,discount_amount,payable_amount,is_paid,status,payment_mode,payment_reference,payment_notes,amount_paid,remaining_amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING order_id",
                [pid, user_id, order_group_id, qty, unitPrice, total_cost, discount_percentage, discount_amount, payable_amount, is_paid, status, final_payment_mode, final_payment_reference, final_payment_notes, amount_paid, remaining_amount]
            );
            const orderId = created.rows?.[0]?.order_id ?? null;
            if (orderId) {
                await recordOrderAction(
                    orderId,
                    user_id,
                    null,
                    null,
                    'user',
                    is_paid ? 'paid' : 'pending_payment',
                    is_paid ? 'Order placed with payment' : 'Order placed with deferred payment',
                    JSON.stringify({ payment_mode: final_payment_mode, payment_reference: final_payment_reference })
                );
            }
            return {
                message: "your order is placed",
                tracking_id: orderId,
                order: {
                    product_id: pid,
                    user_id,
                    quantity: qty,
                    product_price: unitPrice,
                    total_cost,
                    is_paid,
                    status,
                    amount_paid,
                    remaining_amount,
                    payment_mode: final_payment_mode,
                    payment_reference: final_payment_reference,
                    payment_notes: final_payment_notes,
                },
            };
        } catch (err) {
            return { message: "error occured while placing order", error: err.message };
        }
    } catch (err) {
        return { message: "error occured while placing order", error: err.message };
    }
};

export const cancelOrder = async (
    product_id,
    user_id,
    order_id,
    actionByUserId = null,
    actionByUserName = null,
    actionByUserPhone = null,
    actionByRole = 'user'
) => {
    try {
        if (!user_id && !actionByUserId) {
            return { message: "Invalid parameters try again" };
        }
        if (!product_id && !order_id) {
            return { message: "Invalid parameters try again" };
        }
        await ensureOrderSchema();
        try {
            let orderRow;
            if (order_id) {
                const selectedById = await db.query(
                    "SELECT order_id,product_id,user_id,amount_paid,status FROM orders WHERE order_id=$1 LIMIT 1",
                    [order_id]
                );
                orderRow = selectedById.rows?.[0];
            } else {
                const pid = String(product_id);
                const selectedByProduct = await db.query(
                    "SELECT order_id,product_id,user_id,amount_paid,status FROM orders WHERE product_id=$1 AND user_id=$2 ORDER BY order_id DESC LIMIT 1",
                    [pid, user_id]
                );
                orderRow = selectedByProduct.rows?.[0];
            }
            if (!orderRow) {
                return { message: "order not found" };
            }
            if (orderRow.status === 'cancelled') {
                return { message: "order already cancelled" };
            }
            await db.query("UPDATE orders SET status='cancelled' WHERE order_id=$1", [orderRow.order_id]);
            await recordOrderAction(
                orderRow.order_id,
                actionByUserId || user_id,
                actionByUserName,
                actionByUserPhone,
                actionByRole,
                'cancel',
                'Order cancelled',
                null
            );
            return {
                message: "your order is successfully cancelled",
                order_id: orderRow.order_id,
                product_id: orderRow.product_id,
                user_id: orderRow.user_id,
                refund_amount: Number(orderRow.amount_paid || 0),
                was_paid: Number(orderRow.amount_paid || 0) > 0,
            };
        } catch (err) {
            return { message: "error occured while cancelling order", error: err.message };
        }
    } catch (err) {
        return { message: "error occured while cancelling order", error: err.message };
    }
};

export const updatePaymentProgress = async (
    order_id,
    amount_received,
    payment_mode,
    payment_reference,
    payment_notes,
    actionByUserId,
    actionByUserName,
    actionByUserPhone,
    actionByRole = 'admin'
) => {
    try {
        await ensureOrderSchema();
        if (!order_id || !amount_received || amount_received <= 0) {
            return { message: 'Invalid payment information' };
        }
        const selected = await db.query(
            "SELECT order_id, total_cost, payable_amount, amount_paid, remaining_amount, status FROM orders WHERE order_id=$1 LIMIT 1",
            [order_id]
        );
        const orderRow = selected.rows?.[0];
        if (!orderRow) {
            return { message: 'order not found' };
        }
        if (orderRow.status === 'cancelled') {
            return { message: 'order is cancelled' };
        }
        const existingPaid = Number(orderRow.amount_paid || 0);
        const payable = Number(orderRow.payable_amount ?? (orderRow.total_cost || 0));
        const newPaid = existingPaid + Number(amount_received);
        if (newPaid > payable) {
            return { message: 'Amount exceeds remaining balance' };
        }
        const remaining_amount = payable - newPaid;
        const is_paid = newPaid >= payable;
        const status = is_paid ? 'paid' : 'partial';

        await db.query(
            "UPDATE orders SET amount_paid=$1, remaining_amount=$2, is_paid=$3, status=$4, payment_mode=$5, payment_reference=$6, payment_notes=$7 WHERE order_id=$8",
            [newPaid, remaining_amount, is_paid, status, payment_mode, payment_reference, payment_notes, order_id]
        );

        await recordOrderAction(
            order_id,
            actionByUserId,
            actionByUserName,
            actionByUserPhone,
            actionByRole,
            'payment_update',
            `Received ${amount_received} payment`,
            JSON.stringify({ amount_received, payment_mode, payment_reference, payment_notes })
        );

        return {
            message: 'payment updated successfully',
            order_id,
            amount_paid: newPaid,
            remaining_amount,
            is_paid,
            status,
        };
    } catch (err) {
        return { message: 'error occured while updating payment', error: err.message };
    }
};

export const updatePaymentProgressForGroup = async (
    order_group_id,
    amount_received,
    payment_mode,
    payment_reference,
    payment_notes,
    actionByUserId,
    actionByUserName,
    actionByUserPhone,
    actionByRole = 'admin'
) => {
    try {
        await ensureOrderSchema();
        if (!order_group_id || !amount_received || amount_received <= 0) {
            return { message: 'Invalid parameters' };
        }

        const selected = await db.query(
            "SELECT order_id, total_cost, amount_paid, remaining_amount, status FROM orders WHERE order_group_id=$1 AND status != 'cancelled' ORDER BY order_id ASC",
            [order_group_id]
        );
        const orders = selected.rows || [];
        if (orders.length === 0) {
            return { message: 'order group not found' };
        }

        let remainingToAllocate = Number(amount_received);
        const updated = [];

        for (const o of orders) {
            if (remainingToAllocate <= 0) break;
            const payable = Number(o.payable_amount ?? (o.total_cost || 0));
            const existingPaid = Number(o.amount_paid || 0);
            const orderRemaining = Math.max(payable - existingPaid, 0);
            if (orderRemaining <= 0) continue;

            const allocate = Math.min(orderRemaining, remainingToAllocate);
            const newPaid = existingPaid + allocate;
            const newRemaining = Math.max(payable - newPaid, 0);
            const is_paid = newPaid >= payable;
            const status = is_paid ? 'paid' : 'partial';

            await db.query(
                "UPDATE orders SET amount_paid=$1, remaining_amount=$2, is_paid=$3, status=$4, payment_mode=$5, payment_reference=$6, payment_notes=$7 WHERE order_id=$8",
                [newPaid, newRemaining, is_paid, status, payment_mode, payment_reference, payment_notes, o.order_id]
            );

            await recordOrderAction(
                o.order_id,
                actionByUserId,
                actionByUserName,
                actionByUserPhone,
                actionByRole,
                'payment_update',
                `Received ${allocate} payment (group)`,
                JSON.stringify({ amount_received: allocate, payment_mode, payment_reference, payment_notes })
            );

            updated.push({ order_id: o.order_id, allocated: allocate, amount_paid: newPaid, remaining_amount: newRemaining, is_paid, status });
            remainingToAllocate -= allocate;
        }

        return {
            message: 'group payment applied',
            order_group_id,
            allocated: Number(amount_received) - remainingToAllocate,
            remaining_amount: remainingToAllocate,
            updated,
        };
    } catch (err) {
        return { message: 'error occured while updating group payment', error: err.message };
    }
};

export const changeOrderQuantity = async (
    order_id,
    delta,
    actionByUserId,
    actionByUserName,
    actionByUserPhone,
    actionByRole = 'admin'
) => {
    try {
        await ensureOrderSchema();
        if (!order_id || !delta || Number(delta) === 0) {
            return { message: 'Invalid parameters for quantity update' };
        }

        const selected = await db.query(
            "SELECT order_id, quantity, product_price, discount_percentage, amount_paid, status FROM orders WHERE order_id=$1 LIMIT 1",
            [order_id]
        );
        const orderRow = selected.rows?.[0];
        if (!orderRow) {
            return { message: 'order not found' };
        }
        if (orderRow.status === 'cancelled') {
            return { message: 'order is cancelled' };
        }

        const newQuantity = Math.max(1, Number(orderRow.quantity || 0) + Number(delta));
        const unitPrice = Number(orderRow.product_price || 0);
        const total_cost = newQuantity * unitPrice;
        const discount_percentage = Number(orderRow.discount_percentage || 0);
        const discount_amount = Number((total_cost * discount_percentage) / 100);
        const payable_amount = total_cost - discount_amount;
        const amount_paid = Number(orderRow.amount_paid || 0);
        const remaining_amount = Math.max(payable_amount - amount_paid, 0);
        const is_paid = amount_paid >= payable_amount;
        const status = orderRow.status === 'cancelled' ? 'cancelled' : is_paid ? 'paid' : amount_paid > 0 ? 'partial' : 'pending';

        await db.query(
            "UPDATE orders SET quantity=$1, total_cost=$2, discount_amount=$3, payable_amount=$4, remaining_amount=$5, is_paid=$6, status=$7 WHERE order_id=$8",
            [newQuantity, total_cost, discount_amount, payable_amount, remaining_amount, is_paid, status, order_id]
        );

        await recordOrderAction(
            order_id,
            actionByUserId,
            actionByUserName,
            actionByUserPhone,
            actionByRole,
            delta > 0 ? 'quantity_increase' : 'quantity_decrease',
            `Order quantity ${delta > 0 ? 'increased' : 'decreased'} by ${Math.abs(delta)}`,
            JSON.stringify({ delta, quantity: newQuantity, total_cost, discount_percentage, discount_amount, payable_amount })
        );

        return {
            message: 'order quantity updated',
            order_id,
            quantity: newQuantity,
            total_cost,
            discount_percentage,
            discount_amount,
            payable_amount,
            amount_paid,
            remaining_amount,
            status,
        };
    } catch (err) {
        return { message: 'error occured while updating quantity', error: err.message };
    }
};

export const applyOrderDiscount = async (
    order_id,
    discount_percentage,
    actionByUserId,
    actionByUserName,
    actionByUserPhone,
    actionByRole = 'admin'
) => {
    try {
        await ensureOrderSchema();
        if (!order_id || discount_percentage === undefined || discount_percentage === null) {
            return { message: 'Invalid parameters for discount update' };
        }

        const selected = await db.query(
            "SELECT order_id, quantity, product_price, amount_paid, status FROM orders WHERE order_id=$1 LIMIT 1",
            [order_id]
        );
        const orderRow = selected.rows?.[0];
        if (!orderRow) {
            return { message: 'order not found' };
        }
        if (orderRow.status === 'cancelled') {
            return { message: 'order is cancelled' };
        }

        const pct = Math.max(0, Math.min(100, Number(discount_percentage)));
        const total_cost = Number(orderRow.quantity || 0) * Number(orderRow.product_price || 0);
        const discount_amount = Number(((total_cost * pct) / 100).toFixed(2));
        const payable_amount = total_cost - discount_amount;
        const amount_paid = Number(orderRow.amount_paid || 0);
        const remaining_amount = Math.max(payable_amount - amount_paid, 0);
        const is_paid = amount_paid >= payable_amount;
        const status = orderRow.status === 'cancelled' ? 'cancelled' : is_paid ? 'paid' : amount_paid > 0 ? 'partial' : 'pending';

        await db.query(
            "UPDATE orders SET discount_percentage=$1, discount_amount=$2, payable_amount=$3, remaining_amount=$4, is_paid=$5, status=$6 WHERE order_id=$7",
            [pct, discount_amount, payable_amount, remaining_amount, is_paid, status, order_id]
        );

        await recordOrderAction(
            order_id,
            actionByUserId,
            actionByUserName,
            actionByUserPhone,
            actionByRole,
            'discount_applied',
            `Applied ${pct}% discount`,
            JSON.stringify({ discount_percentage: pct, discount_amount, payable_amount })
        );

        return {
            message: 'order discount applied',
            order_id,
            discount_percentage: pct,
            discount_amount,
            payable_amount,
            amount_paid,
            remaining_amount,
            status,
        };
    } catch (err) {
        return { message: 'error occured while applying discount', error: err.message };
    }
};

export const cancelOrderGroup = async (
    order_group_id,
    actionByUserId = null,
    actionByUserName = null,
    actionByUserPhone = null,
    actionByRole = 'user'
) => {
    try {
        await ensureOrderSchema();
        if (!order_group_id) {
            return { message: 'Invalid parameters' };
        }
        const selected = await db.query(
            "SELECT order_id,product_id,user_id,amount_paid,status FROM orders WHERE order_group_id=$1",
            [order_group_id]
        );
        const rows = selected.rows || [];
        if (rows.length === 0) {
            return { message: 'order group not found' };
        }

        let totalRefund = 0;
        const cancelled = [];

        for (const r of rows) {
            if (r.status === 'cancelled') continue;
            await db.query("UPDATE orders SET status='cancelled' WHERE order_id=$1", [r.order_id]);
            await recordOrderAction(
                r.order_id,
                actionByUserId || r.user_id,
                actionByUserName,
                actionByUserPhone,
                actionByRole,
                'cancel',
                'Order cancelled (group)',
                null
            );
            totalRefund += Number(r.amount_paid || 0);
            cancelled.push({ order_id: r.order_id, product_id: r.product_id, user_id: r.user_id, refund_amount: Number(r.amount_paid || 0) });
        }

        return { message: 'group cancelled', order_group_id, cancelled, totalRefund };
    } catch (err) {
        return { message: 'error occured while cancelling group', error: err.message };
    }
};

export const changeOrderStatus = async (order_id, status, actionByUserId, actionByUserName, actionByUserPhone, actionByRole, actionNote = null) => {
    try {
        if (!order_id || !status) {
            return { message: 'Invalid parameters' };
        }
        await ensureOrderSchema();
        const selected = await db.query(
            "SELECT order_id FROM orders WHERE order_id=$1 LIMIT 1",
            [order_id]
        );
        if (selected.rows.length === 0) {
            return { message: 'order not found' };
        }
        await db.query("UPDATE orders SET status=$1 WHERE order_id=$2", [status, order_id]);
        await recordOrderAction(order_id, actionByUserId, actionByUserName, actionByUserPhone, actionByRole, status, actionNote, null);
        return { message: `order ${status}`, order_id, status };
    } catch (err) {
        return { message: 'error occured while changing order status', error: err.message };
    }
};

export const orderDetails = async (user_id) => {
    try {
        if (!user_id) {
            return { message: "Invalid user" };
        }
        await ensureOrderSchema();
        try {
            const orderHistory = await db.query(
                `SELECT
                    o.*, 
                    p.name AS product_name,
                    p.category AS product_category,
                    u.name AS customer_name,
                    u.email AS customer_email,
                    oa.action_type AS last_action_type,
                    oa.action_by_user_id AS last_action_by_user_id,
                    oa.action_by_user_name AS last_action_by_user_name,
                    oa.action_by_user_phone AS last_action_by_user_phone,
                    oa.action_by_role AS last_action_by_role,
                    oa.action_note AS last_action_note,
                    oa.created_at AS last_action_at
                FROM orders o
                LEFT JOIN products p ON CAST(o.product_id AS TEXT) = CAST(p.id AS TEXT)
                LEFT JOIN users u ON CAST(o.user_id AS TEXT) = CAST(u.id AS TEXT)
                LEFT JOIN LATERAL (
                    SELECT action_type, action_by_user_id, action_by_user_name, action_by_user_phone, action_by_role, action_note, created_at
                    FROM order_actions
                    WHERE order_id = o.order_id
                    ORDER BY created_at DESC
                    LIMIT 1
                ) oa ON true
                WHERE o.user_id=$1`,
                [user_id]
            );
            return { message: "order details fetched", orders: orderHistory.rows || [] };
        } catch (err) {
            return { message: "error occured while fetching order details", error: err.message };
        }
    } catch (err) {
        return { message: "error occured while fetching order details", error: err.message };
    }
};

export const fetchAllOrders = async () => {
    try {
        await ensureOrderSchema();
        const orderHistory = await db.query(
            `SELECT
                o.*, 
                p.name AS product_name,
                u.name AS customer_name,
                u.email AS customer_email,
                oa.action_type AS last_action_type,
                oa.action_by_user_id AS last_action_by_user_id,
                oa.action_by_user_name AS last_action_by_user_name,
                oa.action_by_user_phone AS last_action_by_user_phone,
                oa.action_by_role AS last_action_by_role,
                oa.action_note AS last_action_note,
                oa.created_at AS last_action_at
            FROM orders o
            LEFT JOIN products p ON CAST(o.product_id AS TEXT) = CAST(p.id AS TEXT)
            LEFT JOIN users u ON CAST(o.user_id AS TEXT) = CAST(u.id AS TEXT)
            LEFT JOIN LATERAL (
                SELECT action_type, action_by_user_id, action_by_user_name, action_by_user_phone, action_by_role, action_note, created_at
                FROM order_actions
                WHERE order_id = o.order_id
                ORDER BY created_at DESC
                LIMIT 1
            ) oa ON true
            ORDER BY o.order_id DESC`
        );
        return { message: "admin order details fetched", orders: orderHistory.rows || [] };
    } catch (err) {
        return { message: "error occured while fetching admin order details", error: err.message };
    }
};

export const fetchOrderActions = async (order_id) => {
    try {
        await ensureOrderSchema();
        if (!order_id) {
            return [];
        }
        const result = await db.query(
            `SELECT action_id, order_id, action_by_user_id, action_by_user_name, action_by_user_phone, action_by_role, action_type, action_note, action_metadata, created_at
            FROM order_actions
            WHERE CAST(order_id AS TEXT) = CAST($1 AS TEXT)
            ORDER BY created_at DESC`,
            [order_id]
        );
        return result.rows || [];
    } catch (err) {
        return [];
    }
};
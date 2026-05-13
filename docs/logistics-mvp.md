# Logistics Management Minimum Viable Product (MVP)
**Version**: 2026.05.13.V1
**Objective**: Define the automated management and fulfillment protocol for physical hardware products.

## 1. System Overview
The Logistics MVP governs the lifecycle of "Physical Products" from payment confirmation to final shipment. It centralizes order tracking for administrators and provides transparency for students.

```mermaid
graph TD
    A[使用者購買硬體產品] -->|支付成功| B(Firestore: orders)
    B -->|fulfillmentStatus: PENDING| C{管理員每日提醒}
    C -->|Email Link| D[管理員開啟 Logistics Tab]
    D -->|查看待辦訂單| E{實際出貨流程}
    E -->|完成出貨| F[點擊 Mark as Shipped]
    F -->|呼叫 Cloud Function| G(更新狀態為 SHIPPED)
    G -->|同步更新| H[學員儀表板顯示: 已出貨]
    G -->|存檔| I[完成物流週期]
```

## 2. Fulfillment Lifecycle States
| State | Description | Trigger |
| :--- | :--- | :--- |
| `PENDING` | Default state for successful orders containing physical items. | `onPaymentSuccess` trigger. |
| `SHIPPED` | Order has been processed and handed over to the logistics provider. | Admin clicks "Mark as Shipped" in Logistics Tab. |
| `ARCHIVED` | Completed and historic orders (Future expansion). | Manual or automated cleanup. |

## 3. Data Integration & Aggregation

### 3.1 Backend: `getDashboardData`
The protocol requires `getDashboardData` to return a `hardwareOrders` array exclusively for users with `role === 'admin'`.
- **Logic**: Filters all `SUCCESS` orders in the `orders` collection.
- **Criteria**: Matches items with `isPhysical: true` or legacy IDs in `physicalUnitIds`.
- **Payload**: Includes `uid`, `email`, `amount`, `paidAt`, `logistics`, and `fulfillmentStatus`.

### 3.2 Backend: `markOrderShipped`
An atomic Cloud Function that transitions an order's `fulfillmentStatus` to `SHIPPED`.
- **Permission**: Requires `requesterRole === 'admin'`.
- **Side Effects**: Logs the shipment timestamp and potentially triggers a student notification (Future).

## 4. Admin Interface Protocol (`dashboard.js`)

### 4.1 Access Control
- The **Logistics Tab** (`#tab-btn-logistics`) must only be visible if `myRole === 'admin'`.
- Access via URL parameter `?tab=logistics` must be validated against user roles.

### 4.2 Rendering (`renderLogisticsTab`)
- **Data Source**: `dashboardData.hardwareOrders`.
- **View**: A comprehensive table displaying order ID, customer info, item details, and logistics metadata (CVS store info or receiver address).
- **Action**: Provides a "Mark as Shipped" button for any order in `PENDING` status.

## 5. Communication Protocol (`emailService.js`)

### 5.1 Admin Reminders (`sendAdminShipmentReminder`)
- **Trigger**: Daily 9:30 AM cron job.
- **Protocol**: Aggregates all `PENDING` shipments and sends a summary to the admin.
- **Deep Link**: Must point to `${APP_BASE_URL}/dashboard.html?tab=logistics`.

### 5.2 Student Confirmation (`sendPaymentSuccessEmail`)
- **Trigger**: Immediate post-payment.
- **Protocol**: Notifies the student of successful hardware registration.
- **Deep Link**: Points to `${APP_BASE_URL}/dashboard.html?tab=overview` where the student can monitor their personal shipment status.

## 6. Implementation Notes
- **Zero-Cost Strategy**: Relies on Cloud Functions `onCall` and `Firestore` triggers without expensive 3rd party logistics API polling (manual transition to `SHIPPED`).
- **Data Integrity**: Logistics information (e.g., ECPay CVS info) is stored directly in the `orders` document under the `logistics` key.

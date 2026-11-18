# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)
## Membership Management & Administration System

**Version:** 1.0  
**Document Type:** Software Development Specification

---

# 1. PROJECT OVERVIEW

## 1.1 Purpose

Develop a web-based Membership Management System to replace the existing Excel-based membership and payment tracking spreadsheets.

The system will manage the complete membership lifecycle, including:

- New member registration.
- Member contact and company information.
- Membership categories and classification.
- New member onboarding and progress tracking.
- Invoice management.
- Membership payments.
- Annual membership renewals.
- Expiry date tracking.
- Payment reminders and notifications.
- Membership reports and administration.

The application should provide a centralized database where administrators can monitor all members, their onboarding progress, payment records and membership status.

## 1.2 Technology Stack

Use the following technologies:

| Component | Technology |
|---|---|
| Frontend | Next.js / React |
| Backend | Node.js / NestJS |
| Database | PostgreSQL |
| ORM | Prisma or TypeORM |
| Authentication | JWT |
| UI | Tailwind CSS |
| Notifications | In-app notifications and email |
| File Storage | Secure document storage |
| Deployment | Docker-compatible cloud hosting |

The application must be responsive and accessible on desktop, tablet and mobile devices.

# 2. SYSTEM MODULES

The application will have the following modules:

1. Dashboard
2. Member Management
3. New Member Registration
4. Onboarding Management
5. Membership Categories
6. Invoice Management
7. Payment Management
8. Membership Renewals
9. Notifications and Reminders
10. Reports and Analytics
11. User and Access Management
12. System Settings

# 3. MEMBER MANAGEMENT

## 3.1 Member Registration

Administrators must be able to register new members.

Each member must have the following information:

### Company information
- Automatically generated internal ID.
- Company name.
- Membership number.
- Membership category.
- Registration date.
- Membership start date.
- Membership status.
- Company address.
- Company website (optional).

### Contact information

Each company must support at least three contact persons.

**Contact Person 1**
- Full name.
- Job title.
- Phone number.
- Email address.

**Contact Person 2**
- Full name.
- Job title.
- Phone number.
- Email address.

**Contact Person 3**
- Full name.
- Job title.
- Phone number.
- Email address.

Allow administrators to add more contacts if necessary.

### Membership categories

The system must support:

- Bronze
- Silver
- Gold
- Platinum

Administrators should be able to manage category names and associated membership fees through settings.

### Membership status

Support the following statuses:

- Paid
- Unpaid
- Onboarding
- Cancelled

Also track expired and renewal-due conditions separately so that historical member records are preserved.

## 3.2 Member Profile

Every member should have an individual profile containing:

- Company details.
- Membership information.
- All contact persons.
- Onboarding progress.
- Invoice history.
- Payment history.
- Membership certificates.
- Reminder history.
- Renewal history.
- Administrative notes.

Administrators should be able to edit member information without losing historical records.

# 4. NEW MEMBER ONBOARDING MANAGEMENT

This is a core module of the application.

The system must track the different activities required to complete the registration and onboarding of a new member.

## 4.1 Onboarding stages

Each new member must go through the following workflow:

| Stage | Description |
|---|---|
| 1. Registration | Company and contact details captured |
| 2. Invoice | Membership invoice issued |
| 3. WhatsApp | Member added to the relevant WhatsApp group |
| 4. Certificate | Membership certificate prepared and issued |
| 5. Database | Member added to the official membership database |
| 6. Completion | All onboarding activities completed |

## 4.2 Stage tracking

Each stage must have:

- Completion checkbox.
- Status: Pending / In Progress / Completed.
- Date completed.
- Responsible staff member.
- Notes.
- Supporting document attachment where applicable.

The system must automatically calculate onboarding completion percentage.

Example:

A member with three completed activities out of six should show 50% onboarding progress.

## 4.3 Onboarding dashboard

Provide an overview showing:

- Total members being onboarded.
- Members awaiting invoices.
- Members awaiting WhatsApp addition.
- Members awaiting certificates.
- Members awaiting database registration.
- Fully onboarded members.

Administrators must be able to filter members by pending onboarding stage.

The system must not automatically mark onboarding as complete merely because payment has been received.

# 5. INVOICE MANAGEMENT

Administrators must be able to create and manage membership invoices.

Each invoice must contain:

- Invoice number.
- Member/company name.
- Membership number.
- Membership category.
- Invoice date.
- Payment due date.
- Amount payable.
- Currency.
- Invoice status.
- Invoice attachment.

Invoice statuses:

- Draft
- Issued
- Partially Paid
- Paid
- Overdue
- Cancelled

The system must maintain an invoice history for each member.

# 6. PAYMENT MANAGEMENT

This module replaces the existing Excel payment tracking spreadsheet.

## 6.1 Payment record fields

Each payment record must include:

| Field | Description |
|---|---|
| Company | Member company |
| Member number | Unique membership number |
| Category | Bronze/Silver/Gold/Platinum |
| Invoice date | Date invoice was issued |
| Payment due date | Deadline for payment |
| Payment date | Actual date payment was received |
| Amount invoiced | Total amount payable |
| Amount paid | Amount received |
| Outstanding balance | Automatically calculated |
| Payment status | Paid / Unpaid / Partially Paid / Overdue |
| Last reminder date | Date last reminder email was sent |
| Notes | Additional information |

## 6.2 Payment history

The system must support multiple payment records against a member and multiple payments against an invoice.

Never overwrite an existing payment when recording a new payment.

Maintain a complete transaction history.

## 6.3 Months past due

Automatically calculate how many months a payment is overdue.

The calculation must use the payment due date and current date.

For paid invoices, the overdue calculation should stop.

# 7. MEMBERSHIP EXPIRY AND RENEWAL MANAGEMENT

Membership is managed on an annual basis.

## 7.1 Automatic expiry calculation

Once a membership payment is confirmed:

- Record the actual payment date.
- Calculate the membership expiry date.
- Set the next renewal date automatically.

Default calculation:

**Membership expiry date = Payment date + 1 year.**

The one-year renewal period should be configurable in system settings.

The application must preserve previous membership periods when a member renews.

## 7.2 Renewal tracking

Display:

- Membership start date.
- Current expiry date.
- Next renewal date.
- Renewal payment status.
- Previous renewal records.

## 7.3 Renewal alerts

Generate notifications:

- 30 days before expiry.
- 14 days before expiry.
- 7 days before expiry.
- On the expiry date.
- After expiry if payment remains outstanding.

Administrators must be able to see all members approaching expiry.

# 8. NOTIFICATION AND REMINDER SYSTEM

## 8.1 In-app notifications

The application must display notification pop-ups or alerts when:

- An invoice reaches its payment due date.
- A payment becomes overdue.
- A membership is approaching expiry.
- A membership expires.
- An onboarding task remains incomplete.

Provide a notification centre showing all outstanding alerts.

Notifications should be dismissible but remain accessible in notification history.

## 8.2 Email reminder tracking

The system must maintain a reminder history for every member.

Each reminder record should contain:

- Member name.
- Email recipient.
- Reminder date.
- Reminder type.
- Email subject.
- Delivery status.
- Staff member or automation responsible.

The member profile must display the most recent reminder date.

The system must automatically update the Last Reminder Date after a reminder is successfully sent.

Support manual email reminders and automated reminders.

## 8.3 Reminder configuration

Allow administrators to configure:

- Reminder intervals.
- Email templates.
- Reminder recipients.
- Automated reminder activation.
- Notification preferences.

Prevent duplicate automated reminders for the same event and reminder interval.

# 9. DASHBOARD

The dashboard should provide an overview of the organization's membership operations.

## 9.1 Summary cards

Display:

- Total registered members.
- Paid members.
- Unpaid members.
- Members currently onboarding.
- Cancelled memberships.
- Expired memberships.
- Memberships expiring soon.
- Overdue invoices.

## 9.2 Payment overview

Display:

- Payments received this month.
- Outstanding payments.
- Overdue payments.
- Total invoiced amount.
- Total collected amount.

## 9.3 Membership category overview

Display member counts by:

- Bronze
- Silver
- Gold
- Platinum

## 9.4 Pending actions

Display a task list showing:

- Payments due today.
- Overdue payments.
- Upcoming renewals.
- Pending certificates.
- Members awaiting WhatsApp group addition.
- Incomplete onboarding activities.

Clicking an item should open the relevant member or invoice record.

# 10. MEMBER DIRECTORY

Create a searchable and filterable member directory.

Columns:

- Member number.
- Company name.
- Category.
- Primary contact.
- Email.
- Phone.
- Registration date.
- Membership expiry date.
- Membership status.
- Onboarding progress.

Search by:

- Company name.
- Member number.
- Contact person.
- Phone number.
- Email address.

Filters:

- Membership category.
- Membership status.
- Payment status.
- Expiry status.
- Onboarding status.

Allow sorting by registration date, expiry date and company name.

# 11. REPORTS AND ANALYTICS

Provide downloadable reports in Excel and PDF.

Reports should include:

1. Complete membership register.
2. Members by category.
3. Paid and unpaid members.
4. Overdue invoices.
5. Payment collection report.
6. Membership expiry report.
7. Annual renewal report.
8. Onboarding progress report.
9. Cancelled memberships.
10. Reminder history.

Allow filtering reports by date range, category and status.

# 12. USER MANAGEMENT AND PERMISSIONS

Support multiple administrative users.

Initial roles:

**Administrator**
- Full access.
- Create and edit members.
- Manage payments.
- Manage invoices.
- Manage users.
- Configure settings.
- View reports.

**Membership Officer**
- Register members.
- Update member details.
- Manage onboarding.
- Update membership records.

**Finance Officer**
- Create invoices.
- Record payments.
- Update payment information.
- Manage payment reminders.
- View financial reports.

Maintain an audit log recording:

- User responsible.
- Action performed.
- Record affected.
- Previous value.
- New value.
- Date and time.

# 13. DATABASE DESIGN

Use PostgreSQL with a relational database structure.

Required entities:

1. Users
2. Roles
3. Members
4. Member Contacts
5. Membership Categories
6. Membership Periods
7. Onboarding Tasks
8. Invoices
9. Payments
10. Reminder History
11. Notifications
12. Certificates and Documents
13. Audit Logs
14. System Settings

## Database relationships

- One member can have multiple contacts.
- One member can have multiple membership periods.
- One member can have multiple invoices.
- One invoice can have multiple payments.
- One member can have multiple onboarding tasks.
- One member can have multiple reminders.
- One member can have multiple documents.
- One user can perform multiple administrative actions.

Use foreign keys, indexes and appropriate constraints.

# 14. USER INTERFACE REQUIREMENTS

The interface should be modern, professional, clean and easy to navigate.

Suggested sidebar:

- Dashboard
- Members
- Register Member
- Onboarding
- Invoices
- Payments
- Renewals
- Notifications
- Reports
- Settings

Design requirements:

- Clean administrative dashboard.
- Professional data tables.
- Search and filtering.
- Status indicators.
- Progress bars.
- Calendar-based expiry views.
- Notification badges.
- Confirmation dialogs for important actions.
- Responsive mobile layout.

Avoid overcrowded screens.

# 15. SECURITY AND DATA INTEGRITY

Implement:

- Secure authentication.
- Password hashing.
- Role-based access control.
- Server-side validation.
- Secure document access.
- Database backups.
- Audit logging.
- Protection against duplicate member records.
- Protection against duplicate payment transactions.
- Secure API endpoints.

Do not permanently delete financial transactions or membership history through ordinary administrative actions.

# 16. ACCEPTANCE CRITERIA

The application will be considered functional when the following scenarios work correctly:

1. An administrator can register a new member.
2. The system generates a unique member number.
3. Three or more contact persons can be added.
4. The member can be assigned a membership category.
5. The administrator can track each onboarding stage.
6. Onboarding completion percentage updates automatically.
7. An invoice can be issued and tracked.
8. Multiple payments can be recorded against an invoice.
9. Payment balances update automatically.
10. Payment due dates trigger in-app notifications.
11. Last reminder date updates after successful email delivery.
12. Membership expiry is calculated automatically after payment confirmation.
13. Renewal reminders are generated at configured intervals.
14. Previous membership and payment history remains available.
15. Members can be searched and filtered.
16. Reports can be exported to Excel and PDF.
17. Different administrative users have appropriate permissions.
18. All important changes are recorded in the audit log.

# 17. DEVELOPMENT ROADMAP

Build the application in the following phases.

**Phase 1: Foundation**
- Project setup.
- Database configuration.
- Authentication.
- User roles.
- Application layout.

**Phase 2: Member Management**
- Member registration.
- Member profiles.
- Contact management.
- Membership categories.
- Member directory.

**Phase 3: Onboarding**
- Onboarding workflow.
- Task tracking.
- Progress indicators.
- Document uploads.

**Phase 4: Financial Management**
- Invoice management.
- Payment records.
- Outstanding balances.
- Payment history.
- Due-date calculations.

**Phase 5: Membership Renewals**
- Membership periods.
- Expiry calculations.
- Renewal records.
- Renewal tracking.

**Phase 6: Notifications**
- In-app notifications.
- Email integration.
- Reminder history.
- Automated notification schedules.

**Phase 7: Reporting**
- Dashboard analytics.
- Membership reports.
- Financial reports.
- Excel/PDF exports.

**Phase 8: Testing and Deployment**
- Functional testing.
- Security testing.
- Database backup configuration.
- Production deployment.
- User acceptance testing.

# 18. IMPORTANT DEVELOPMENT INSTRUCTIONS

The development agent must follow these instructions:

1. Build a complete working application, not just a UI prototype.
2. Implement real database persistence.
3. Do not use mock data as the permanent data source.
4. Use proper database relationships.
5. Implement backend validation and business logic.
6. All dates must be handled consistently, using configurable organizational timezone settings.
7. Payment, expiry and renewal calculations must be tested.
8. Preserve historical membership and payment records.
9. Make all dashboard figures derive from actual database records.
10. Implement automated tests for critical business processes.
11. Provide database migrations and seed scripts.
12. Provide a README with installation and deployment instructions.

**Final objective:** Deliver a complete Membership Management System that replaces the existing Excel spreadsheets and gives administrators one centralized platform for managing members, onboarding, invoices, payments, reminders and annual membership renewals.
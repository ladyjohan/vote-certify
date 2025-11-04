# EmailJS Decline Email Setup Guide

This guide will help you set up the EmailJS template for sending decline emails to voters when their certificate requests are declined.

## Step 1: Log in to EmailJS

1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Log in to your account (use the same account that has the Public Key: `c4wdO5d7b4OvOf5ae`)

## Step 2: Navigate to Email Templates

1. Once logged in, click on **"Email Templates"** in the left sidebar
2. You should see your existing templates (including the approval template `template_gbdx50m`)

## Step 3: Create a New Template

1. Click the **"+ Create New Template"** button
2. Give it a name: **"Decline Request"** or **"Voter Certificate Request Declined"**
3. The template ID will be auto-generated (e.g., `template_xxxxx`)
4. **IMPORTANT**: Copy this Template ID - you'll need to update it in the code

## Step 4: Design the Email Template

Use the following HTML structure to match your approval email design:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 20px; text-align: center; border-bottom: 1px solid #e0e0e0;">
              <h1 style="margin: 0; font-size: 24px; color: #333333; font-weight: bold;">Voter Certificate Request Declined</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px 20px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                Hello <strong>{{name}}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                We regret to inform you that your request has been <strong style="color: #dc3545;">declined</strong>.
              </p>
              
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #856404;">
                  Reason for Decline:
                </p>
                <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6; white-space: pre-wrap;">
                  {{remarks}}
                </p>
              </div>
              
              <p style="margin: 20px 0 0 0; font-size: 16px; color: #333333; line-height: 1.6;">
                If you have any questions or concerns, please contact COMELEC Olongapo City for assistance.
              </p>
              
              <p style="margin: 20px 0 0 0; font-size: 14px; color: #666666;">
                Voter ID: <strong>{{voter_id}}</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px; text-align: center; border-top: 1px solid #e0e0e0; background-color: #f9f9f9;">
              <p style="margin: 0; font-size: 12px; color: #999999;">
                Thank you for using VoteCertify!
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

## Step 5: Configure Template Variables

In the template editor, you'll see variable placeholders. Make sure these match:

- `{{name}}` - Voter's full name
- `{{remarks}}` - Staff's decline remarks/reason
- `{{voter_id}}` - Voter's ID
- `{{email}}` - Voter's email (used for sending, not displayed)

## Step 6: Set Up the Subject Line

In the **Subject** field, enter:
```
Voter Certificate Request Declined
```

Or customize it as needed.

## Step 7: Save the Template

1. Click **"Save"** button
2. Note the **Template ID** that was generated (it will be something like `template_xxxxx`)

## Step 8: Update the Code with Your Template ID

1. Open the file: `frontend/votecertify/src/app/pages/staff/request-management/request-management/request-management.component.ts`
2. Find the `sendDeclineEmail` function (around line 217)
3. Replace `'template_decline_request'` with your actual Template ID from Step 7

Example:
```typescript
const result = await emailjs.send(
  'service_g5f5afj',  // your service id
  'template_your_actual_id_here', // Replace with your actual template ID
  templateParams
);
```

## Step 9: Test the Email

1. Go to your staff dashboard
2. Find a pending request (or create a test one)
3. Click "Decline" and enter some test remarks
4. Submit and verify the email is sent correctly

## Troubleshooting

### Email not sending?
- Verify the Template ID is correct
- Check that the Service ID (`service_g5f5afj`) is correct
- Verify the Public Key (`c4wdO5d7b4OvOf5ae`) matches your EmailJS account
- Check the browser console for any error messages

### Template variables not showing?
- Make sure variable names match exactly: `{{name}}`, `{{remarks}}`, `{{voter_id}}`
- Variables are case-sensitive

### Email formatting issues?
- The HTML template uses inline styles for maximum compatibility
- Test in different email clients (Gmail, Outlook, etc.)

## Current Configuration Summary

- **Service ID**: `service_g5f5afj`
- **Public Key**: `c4wdO5d7b4OvOf5ae`
- **Approval Template ID**: `template_gbdx50m`
- **Decline Template ID**: `template_decline_request` (you need to replace this with your actual template ID)

---

**Note**: After creating the template in EmailJS, make sure to update the template ID in the code file!


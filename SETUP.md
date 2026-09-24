# Dad's Client Opportunity Calculator

One website. Two tabs:
- New Client
- Past Clients

The website stores entries in Supabase and shows saved entries in the Past Clients tab.

Setup:
1. Create a Supabase project.
2. Run all of supabase_setup.sql in SQL Editor.
3. Put the project's URL and publishable key into config.js.
4. Open the folder with VS Code and use a local web server such as Live Server.
5. Test with fake information first.
6. The browser creates a device token and stores it locally. Do not clear the browser's site data after setup.

Never put a Supabase secret/service-role key in config.js.
Because the site stores phone and financial information, review applicable privacy, retention, and security requirements before using real client data.

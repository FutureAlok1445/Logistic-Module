import { test, expect } from "@playwright/test";

test("profile photos persist and chat files download, search and remove", async ({
  page,
}) => {
  test.setTimeout(90000);
  await signIn(page);
  await page.goto("/profile");
  await page.getByLabel("Upload profile photo").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXwAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(
    page.getByRole("status").filter({ hasText: "Profile photo updated" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByAltText(/profile photo/)).toBeVisible();
  await page.screenshot({
    path: "output/playwright/profile-upload-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Upload profile photo")).toBeVisible();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "output/playwright/profile-upload-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/team");
  await page
    .getByRole("button", { name: /LOGISTICS_MANAGER/ })
    .first()
    .click();
  await page
    .getByLabel("Direct message", { exact: true })
    .fill("Browser attachment handover");
  await page.getByLabel("Attach message file").setInputFiles({
    name: "browser-handover.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Fictional packing handover"),
  });
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  const file = page.getByRole("button", { name: /browser-handover.txt.*KB/ });
  await expect(file).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await file.click();
  expect((await downloaded).suggestedFilename()).toBe("browser-handover.txt");
  await page.getByLabel("Search conversation").fill("no such attachment term");
  await expect(
    page.getByRole("heading", { name: "No matching messages" }),
  ).toBeVisible();
  await page
    .getByLabel("Search conversation")
    .fill("Browser attachment handover");
  await expect(file).toBeVisible();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "output/playwright/chat-upload-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const control of [
    page.getByLabel("Search conversation"),
    page.getByRole("button", { name: "Send message", exact: true }),
  ]) {
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport({ ratio: 1 });
  }
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "output/playwright/chat-upload-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", {
      name: "Remove attachment browser-handover.txt",
      exact: true,
    })
    .click();
  await expect(file).toHaveCount(0);
});
async function signIn(
  page: import("@playwright/test").Page,
  role = "super_admin",
) {
  await page.goto("/");
  await page.getByLabel("Email address").fill(`${role}@test.example`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("IntegrationOnly!2026");
  const loginResponse = page.waitForResponse(
    (r) => r.url().includes("/auth/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(
    page.getByRole("heading", {
      name:
        role === "warehouse_staff" ? "Warehouse stock" : "Operations overview",
    }),
  ).toBeVisible({ timeout: 15000 });
}
test("desktop session restores, stock receipt works, reports download", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  await signIn(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Operations overview" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Warehouse stock", exact: true })
    .click();
  await page.getByRole("button", { name: "Receive or adjust stock" }).click();
  const receipt = page.getByRole("dialog", { name: "Receive or adjust stock" });
  await receipt.getByLabel("Material", { exact: true }).selectOption("book");
  await receipt.getByLabel("Location", { exact: true }).selectOption("mumbai");
  await receipt.getByLabel("Quantity change").fill("7");
  await receipt
    .getByLabel("Receipt or adjustment reason")
    .fill("Browser verified inward receipt");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Changes saved" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generate report" }).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toContain("elms-dispatch.xlsx");
  await page.goto("/dispatches");
  await expect(
    page.getByRole("heading", { name: "Dispatch desk" }),
  ).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
  await page.screenshot({
    path: "output/playwright/desktop-dispatch.png",
    fullPage: true,
  });
  expect(consoleErrors).toEqual([]);
});
test("import previews CSV and commits only valid rows", async ({ page }) => {
  await signIn(page);
  await page.goto("/imports");
  await page.locator("input[type=file]").setInputFiles({
    name: "verified-pincodes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "code,city,state,serviceable\n110001,Delhi,Delhi,true\n",
    ),
  });
  await page.getByRole("button", { name: "Parse and preview" }).click();
  await expect(
    page.getByRole("heading", { name: "Import preview" }),
  ).toBeVisible();
  await expect(page.getByText("1 valid · 0 invalid")).toBeVisible();
  await page.getByRole("button", { name: "Confirm 1 records" }).click();
  await expect(page.getByRole("status")).toContainText("1 records imported");
});
test("mobile warehouse role opens inventory and keyboard closes dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "warehouse_staff");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("link", { name: "Warehouse stock", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Students", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Close navigation", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Receive or adjust stock" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".sidebar")).toHaveCSS("left", "-250px");
  await page.screenshot({
    path: "output/playwright/mobile-inventory.png",
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test("IMS workbook persists views, filters cells, charts totals and exports", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/excel");
  await page.getByLabel("Upload IMS workbook").setInputFiles({
    name: "ims-browser.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Course,Center,Amount\nCAT,Mumbai,1200\nGATE,Delhi,2500\nCAT,Mumbai,1200\n",
    ),
  });
  await expect(
    page.getByRole("cell", { name: "GATE", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Chart group column").selectOption("Course");
  await page.getByLabel("Chart measure").selectOption("Amount");
  await expect(page.locator(".horizontal-bars")).toContainText("2,400");
  await expect(page.locator(".quality-summary")).toContainText(
    "Duplicate complete rows",
  );
  await page.getByLabel("Workbook name").fill("IMS reviewed browser workbook");
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("preferences saved");
  await page.reload();
  await page
    .getByLabel("Open workbook")
    .selectOption({ label: "IMS reviewed browser workbook" });
  await expect(page.getByLabel("Chart group column")).toHaveValue("Course");
  await page.getByLabel("Search workbook rows").fill("Delhi");
  await expect(page.locator(".sheet-table tbody tr")).toHaveCount(1);
  const file = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export filtered CSV", exact: true })
    .click();
  expect((await file).suggestedFilename()).toBe("ims-filtered-view.csv");
  await page.getByLabel("Search workbook rows").fill("");
  await page.screenshot({
    path: "output/playwright/ims-excel-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "output/playwright/ims-excel-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});
test("employee profile status and internal communication use real backend", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/profile");
  await page.getByLabel("Job title", { exact: true }).fill("Operations lead");
  await page.getByLabel("Availability", { exact: true }).selectOption("BUSY");
  await page
    .getByLabel("Status message", { exact: true })
    .fill("Reviewing courier handovers");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("availability saved");
  await page.goto("/team");
  await page
    .getByLabel("Channel update", { exact: true })
    .fill("Browser verified handover update");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator(".message-thread")).toContainText(
    "Browser verified handover update",
  );
  await page.getByRole("button", { name: /Work board/ }).click();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByLabel("Task title", { exact: true })
    .fill("Verify browser packing run");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(page.locator(".task-columns")).toContainText(
    "Verify browser packing run",
  );
  await page
    .getByLabel("Status for Verify browser packing run", { exact: true })
    .selectOption("IN_PROGRESS");
  await expect(page.locator(".task-columns>section").nth(1)).toContainText(
    "Verify browser packing run",
  );
  await page.screenshot({
    path: "output/playwright/team-hub-desktop.png",
    fullPage: true,
  });
});
test("manager can select 500 shipments across pages", async ({ page }) => {
  await signIn(page, "logistics_manager");
  await page.goto("/dispatches");
  await page
    .getByLabel("Filter status", { exact: true })
    .selectOption("PACKED");
  await page
    .getByLabel("Select filtered shipments", { exact: true })
    .selectOption("500");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "500 filtered shipments selected" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Update selected", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("500 shipments");
  await page.keyboard.press("Escape");
});

test("analysis workbench combines filters, profiles columns and renders chart choices", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/excel");
  await page.getByLabel("Upload IMS workbook").setInputFiles({
    name: "advanced-analysis.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "City,Amount,Date\nMumbai,1200,2026-10-01\nDelhi,2500,2026-10-02\nMumbai,1200,2026-10-03\n",
    ),
  });
  await expect(
    page.getByRole("cell", { name: "Delhi", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Analysis workbench", exact: true })
    .click();
  await page.locator(".advanced-filters summary").click();
  await page
    .getByRole("button", { name: "Add condition", exact: true })
    .click();
  await page
    .getByLabel("Filter column 1", { exact: true })
    .selectOption("Amount");
  await page
    .getByLabel("Filter operator 1", { exact: true })
    .selectOption("gt");
  await page.getByLabel("Filter value 1", { exact: true }).fill("2000");
  await expect(page.locator(".sheet-table tbody tr")).toHaveCount(1);
  await page.getByLabel("Analysis group", { exact: true }).selectOption("City");
  await page
    .getByLabel("Analysis measure", { exact: true })
    .selectOption("Amount");
  await page
    .getByRole("button", { name: "Column profile", exact: true })
    .click();
  await expect(
    page
      .getByRole("table", { name: "Column statistics" })
      .getByRole("row")
      .filter({ hasText: "Amount" }),
  ).toContainText("2,500");
  await page
    .getByRole("button", { name: "Pivot summary", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "Pivot summary" }),
  ).toContainText("Delhi");
  await page.getByRole("button", { name: "Visualise", exact: true }).click();
  for (const chart of ["bar", "line", "area", "histogram"]) {
    await page
      .getByLabel("Visualisation type", { exact: true })
      .selectOption(chart);
    await expect(
      page.locator(".analysis-chart .recharts-wrapper"),
    ).toBeVisible();
  }
  await page
    .getByLabel("Analysis group", { exact: true })
    .selectOption("Amount");
  await page
    .getByLabel("Visualisation type", { exact: true })
    .selectOption("scatter");
  await expect(page.locator(".analysis-chart .recharts-wrapper")).toBeVisible();
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("preferences saved");
  await page.reload();
  await page
    .getByLabel("Open workbook")
    .selectOption({ label: "advanced-analysis.csv" });
  await expect(page.locator(".sheet-table tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Analysis workbench", exact: true })
    .click();
  await expect(page.getByLabel("Visualisation type")).toHaveValue("scatter");
  await page.locator(".advanced-filters summary").click();
  await page
    .getByRole("button", { name: "Clear all conditions", exact: true })
    .click();
  await page.getByLabel("Visualisation type").selectOption("bar");
  await page.getByLabel("Analysis group").selectOption("City");
  await page.screenshot({
    path: "output/playwright/editorial-analysis-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "output/playwright/editorial-analysis-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});
test("unstructured text has a reviewed preview before becoming a worksheet", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/excel");
  await page
    .getByRole("button", { name: "Structure text", exact: true })
    .click();
  await page.getByLabel("Text extraction mode").selectOption("keyvalue");
  await page.getByLabel("Text workbook name").fill("Reviewed handover notes");
  await page
    .getByLabel("Source text to structure")
    .fill("City: Mumbai; Amount: 1200\n\nCity: Delhi; Amount: 2500");
  await expect(
    page.getByRole("heading", { name: /Review 2 records/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save reviewed worksheet", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("private worksheet");
  await expect(
    page.getByRole("cell", { name: "Delhi", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Share insights", exact: true })
    .click();
  await page
    .getByLabel("Share recipient", { exact: true })
    .selectOption("LOGISTICS_MANAGER");
  await page
    .getByRole("button", { name: "Send reviewed summary", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Share reviewed insights" })
      .getByRole("status"),
  ).toContainText("sent privately");
});
test("navigation preferences persist, inbox closes with Escape and missing pages recover", async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  await expect(page.locator(".sidebar")).toHaveCSS("width", "76px");
  await page.reload();
  await expect(page.locator(".sidebar")).toHaveCSS("width", "76px");
  await page
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hide scrollbars", exact: true })
    .click();
  await expect(page.locator(".workspace")).toHaveClass(/quiet-scrollbars/);
  await page
    .getByRole("button", { name: "Open notification centre", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Employee notification centre" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark all read", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".inbox-panel")).toHaveCount(0);
  const result = await page.goto("/unknown/missing-page");
  expect(result?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "A little off course." }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/playwright/editorial-not-found.png",
    fullPage: true,
  });
});

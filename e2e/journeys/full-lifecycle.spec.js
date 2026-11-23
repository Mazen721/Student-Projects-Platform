import { expect, test } from '@playwright/test';

const API_URL = process.env.E2E_API_URL || 'http://localhost:4100/api/v1';

async function apiLogin(request, email, password) {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.data;
}

async function uiLogin(page, email, password) {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app/);
}

test.describe('Full Student Project Lifecycle E2E Journey', () => {
  test('executes end-to-end journey: register -> proposal -> approval -> deliverables -> defense & blind grading -> certificate -> mini-site -> voting -> scoped report', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Lifecycle journey runs once on desktop');

    const uniq = Date.now().toString().slice(-6);
    const studentEmail = `e2e.student.${uniq}@mnu.edu.eg`;
    const studentId = `2026${uniq}`;
    const projectTitle = `منصة المتابعة الذكية ${uniq}`;

    // 1. Student self-registration via Arabic UI
    await page.goto('/register');
    await page.locator('#reg-st-name').fill('أحمد محمود الطالب');
    await page.locator('#reg-st-email').fill(studentEmail);
    await page.locator('#reg-st-id').fill(studentId);
    const collegeOpts = page.locator('#reg-st-college option');
    await expect(collegeOpts).toHaveCount(3); // placeholder + 2 colleges
    await page.locator('#reg-st-college').selectOption({ label: 'كلية الهندسة' });
    await expect(page.locator('#reg-st-dept option')).toHaveCount(2);
    await page.locator('#reg-st-dept').selectOption({ label: 'هندسة الحاسبات والنظم' });
    await page.locator('#reg-st-pass').fill('StudentPass123!');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app/);

    // 2. Create proposal draft via UI
    await page.goto('/app/projects/new');
    await page.locator('#proposal-title').fill(projectTitle);
    await page.locator('#proposal-idea').fill('تطوير منصة متكاملة لإدارة مشاريع الطلاب');
    await page.locator('#proposal-problem').fill('تشتت متابعة المراحل والمخرجات والدرجات');
    await page.locator('#proposal-objectives').fill('توحيد المسار\nرفع جودة المخرجات');
    await page.locator('#proposal-scope').fill('تطبيق ويب متكامل باللغة العربية');
    await page.locator('#proposal-beneficiaries').fill('الطلاب وأعضاء هيئة التدريس');
    await page.locator('#proposal-keywords').fill('إدارة مشاريع, ذكاء اصطناعي');
    await page.locator('#proposal-outcomes').fill('نظام متكامل قابل للنشر والتشغيل');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\/projects\/[a-f0-9]{24}/);

    const projectId = page.url().match(/\/app\/projects\/([a-f0-9]{24})/)[1];

    // Authenticate role actors for backend state verification & multi-actor transitions
    const studentAuth = await apiLogin(request, studentEmail, 'StudentPass123!');
    const supervisorAuth = await apiLogin(request, 'supervisor@mnu.edu.eg', 'E2ePass123!');
    const engAdminAuth = await apiLogin(request, 'eng-admin@mnu.edu.eg', 'E2ePass123!');
    const examiner1Auth = await apiLogin(request, 'examiner1@mnu.edu.eg', 'E2ePass123!');
    const examiner2Auth = await apiLogin(request, 'examiner2@mnu.edu.eg', 'E2ePass123!');
    const visitorAuth = await apiLogin(request, 'visitor-old@example.com', 'E2ePass123!');

    const stHeaders = { Authorization: `Bearer ${studentAuth.accessToken}` };
    const supHeaders = { Authorization: `Bearer ${supervisorAuth.accessToken}` };
    const adminHeaders = { Authorization: `Bearer ${engAdminAuth.accessToken}` };

    // 3. Submit proposal -> Supervisor review & recommend -> Dept Admin approve + assign primary supervisor
    const submitRes = await request.post(`${API_URL}/projects/${projectId}/transitions`, {
      headers: stHeaders,
      data: { event: 'SUBMIT' },
    });
    expect(submitRes.status()).toBe(200);

    const startRevRes = await request.post(`${API_URL}/projects/${projectId}/transitions`, {
      headers: supHeaders,
      data: { event: 'START_REVIEW' },
    });
    expect(startRevRes.status()).toBe(200);

    const recRes = await request.post(`${API_URL}/projects/${projectId}/transitions`, {
      headers: supHeaders,
      data: { event: 'RECOMMEND', comment: 'مقترح ممتاز ومستوفٍ للشروط' },
    });
    expect(recRes.status()).toBe(200);

    const assignRes = await request.put(`${API_URL}/projects/${projectId}/supervision`, {
      headers: supHeaders,
      data: { primaryId: supervisorAuth.user.id },
    });
    expect(assignRes.status()).toBe(200);

    const approveRes = await request.post(`${API_URL}/projects/${projectId}/transitions`, {
      headers: supHeaders,
      data: { event: 'APPROVE', comment: 'معتمد للتنفيذ' },
    });
    expect(approveRes.status()).toBe(200);

    // 4. Deliverable v1/v2 submissions & supervisor approval -> 20% phase 1 of 2 = +10%, then 100%
    const phasesRes = await request.get(`${API_URL}/projects/${projectId}/phases`, {
      headers: stHeaders,
    });
    expect(phasesRes.status()).toBe(200);
    const phasesBody = await phasesRes.json();
    const deliverables = (phasesBody.data.phases || []).flatMap((p) => p.deliverables || []);
    expect(deliverables.length).toBe(3);

    const deliv1 = deliverables[0];
    const subV1 = await request.post(
      `${API_URL}/projects/${projectId}/deliverables/${deliv1.id}/submissions`,
      {
        headers: stHeaders,
        data: { links: [{ kind: 'github', url: 'https://github.com/mnu-spp/demo-v1', title: 'v1' }] },
      }
    );
    expect(subV1.status()).toBe(201);

    const subV2 = await request.post(
      `${API_URL}/projects/${projectId}/deliverables/${deliv1.id}/submissions`,
      {
        headers: stHeaders,
        data: { links: [{ kind: 'github', url: 'https://github.com/mnu-spp/demo-v2', title: 'v2' }] },
      }
    );
    expect(subV2.status()).toBe(201);
    const subV2Body = await subV2.json();
    expect(subV2Body.data.version).toBe(2);

    const rev1 = await request.post(`${API_URL}/submissions/${subV2Body.data.id}/review`, {
      headers: supHeaders,
      data: { decision: 'approved', comment: 'مطابق للمواصفات' },
    });
    expect(rev1.status()).toBe(200);
    expect((await rev1.json()).data.progress.percent).toBe(10);

    for (const deliv of deliverables.slice(1)) {
      const sRes = await request.post(
        `${API_URL}/projects/${projectId}/deliverables/${deliv.id}/submissions`,
        {
          headers: stHeaders,
          data: { links: [{ kind: 'github', url: 'https://github.com/mnu-spp/final' }] },
        }
      );
      expect(sRes.status()).toBe(201);
      const sBody = await sRes.json();
      const rRes = await request.post(`${API_URL}/submissions/${sBody.data.id}/review`, {
        headers: supHeaders,
        data: { decision: 'approved' },
      });
      expect(rRes.status()).toBe(200);
    }

    const projAfterProgress = await (
      await request.get(`${API_URL}/projects/${projectId}`, { headers: stHeaders })
    ).json();
    expect(projAfterProgress.data.progress.percent).toBe(100);

    // 5. Defense sign-off, conflict-free schedule, blind grading, finalization, and PDF certificate
    const signOffRes = await request.post(`${API_URL}/projects/${projectId}/defense/sign-off`, {
      headers: supHeaders,
    });
    expect(signOffRes.status()).toBe(200);

    const schedRes = await request.post(`${API_URL}/projects/${projectId}/defense`, {
      headers: supHeaders,
      data: {
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        durationMin: 45,
        room: 'مدرج ١٠١',
        committee: {
          chairId: examiner1Auth.user.id,
          memberIds: [examiner2Auth.user.id],
          externalExaminerIds: [],
        },
      },
    });
    expect(schedRes.status()).toBe(201);
    const defenseId = (await schedRes.json()).data.id;

    const openGradingRes = await request.post(`${API_URL}/defenses/${defenseId}/transitions`, {
      headers: { Authorization: `Bearer ${examiner1Auth.accessToken}` },
      data: { event: 'OPEN_GRADING' },
    });
    expect(openGradingRes.status()).toBe(200);

    const scorePayload = {
      teamScores: { design: 80 },
      individualScores: { [studentAuth.user.id]: { presentation: 80 } },
      submit: true,
    };

    for (const actorToken of [
      supervisorAuth.accessToken,
      examiner1Auth.accessToken,
      examiner2Auth.accessToken,
    ]) {
      const scRes = await request.put(`${API_URL}/defenses/${defenseId}/my-scores`, {
        headers: { Authorization: `Bearer ${actorToken}` },
        data: scorePayload,
      });
      expect(scRes.status()).toBe(200);
    }

    const finalizeRes = await request.post(`${API_URL}/defenses/${defenseId}/transitions`, {
      headers: { Authorization: `Bearer ${examiner1Auth.accessToken}` },
      data: { event: 'FINALIZE' },
    });
    expect(finalizeRes.status()).toBe(200);

    const pdfRes = await request.get(
      `${API_URL}/projects/${projectId}/grades/${studentAuth.user.id}/certificate.pdf`,
      { headers: stHeaders }
    );
    expect(pdfRes.status()).toBe(200);
    expect(pdfRes.headers()['content-type']).toContain('application/pdf');
    expect((await pdfRes.body()).byteLength).toBeGreaterThan(500);

    // 6. Mini-site build & publish -> Supervisor approves -> Public visit & eligible vote + duplicate block
    const saveShowcase = await request.put(`${API_URL}/projects/${projectId}/showcase`, {
      headers: stHeaders,
      data: {
        template: 'classic',
        theme: 'navy_gold',
        sections: {
          hero: { slogan: 'نحو مشاريع تخرج أكثر جودة' },
          problem: 'صعوبة المتابعة المركزية',
          solution: 'منصة موحدة',
        },
        hiddenSections: [],
      },
    });
    expect(saveShowcase.status()).toBe(200);

    const reqPub = await request.post(`${API_URL}/projects/${projectId}/showcase/transitions`, {
      headers: stHeaders,
      data: { event: 'REQUEST_PUBLISH' },
    });
    expect(reqPub.status()).toBe(200);

    const appPub = await request.post(`${API_URL}/projects/${projectId}/showcase/transitions`, {
      headers: supHeaders,
      data: { event: 'APPROVE' },
    });
    expect(appPub.status()).toBe(200);

    const slug = projAfterProgress.data.slug;
    await page.goto(`/p/${slug}`);
    await expect(page.getByRole('heading', { name: projectTitle })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(studentEmail);

    const voteRes = await request.post(`${API_URL}/projects/${projectId}/vote`, {
      headers: { Authorization: `Bearer ${visitorAuth.accessToken}` },
    });
    expect(voteRes.status()).toBe(201);

    const dupVoteRes = await request.post(`${API_URL}/projects/${projectId}/vote`, {
      headers: { Authorization: `Bearer ${visitorAuth.accessToken}` },
    });
    expect(dupVoteRes.status()).toBe(409);

    // 7. Scoped report UI + Excel/PDF export verification
    await uiLogin(page, 'eng-admin@mnu.edu.eg', 'E2ePass123!');
    await page.goto('/app/reports/completion');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const yearsRes = await request.get(
      `${API_URL}/colleges/${engAdminAuth.user.collegeId}/academic-years`,
      { headers: adminHeaders }
    );
    const ayId = (await yearsRes.json()).data[0]._id;

    const xlsxRes = await request.get(
      `${API_URL}/reports/completion?academicYearId=${ayId}&format=xlsx`,
      { headers: adminHeaders }
    );
    expect(xlsxRes.status()).toBe(200);
    expect((await xlsxRes.body()).byteLength).toBeGreaterThan(500);

    const reportPdfRes = await request.get(
      `${API_URL}/reports/completion?academicYearId=${ayId}&format=pdf`,
      { headers: adminHeaders }
    );
    expect(reportPdfRes.status()).toBe(200);
    expect(reportPdfRes.headers()['content-type']).toContain('application/pdf');
  });
});

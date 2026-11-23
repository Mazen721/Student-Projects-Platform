import {
  CHALLENGE_STATUSES,
  COMPETITION_STATES,
  CONTACT_REQUEST_STATES,
  LINK_KINDS,
  PUBLIC_COMMENT_STATES,
  SHOWCASE_STATES,
  SHOWCASE_TEMPLATES,
  SHOWCASE_THEMES,
  VOTE_STATUSES,
  VOTER_RESTRICTIONS,
} from '@spp/shared/constants';
import AuditLog from '../../core/audit/auditlog.model.js';
import Notification from '../../core/notifications/notification.model.js';
import { runRecalcStatsJob } from '../../jobs/recalcStats.js';
import { runTrendingJob } from '../../jobs/trending.js';
import University from '../../modules/organization/university.model.js';
import Project from '../../modules/projects/project.model.js';
import Bookmark from '../../modules/showcase/bookmark.model.js';
import Challenge from '../../modules/showcase/challenge.model.js';
import Competition from '../../modules/showcase/competition.model.js';
import CompetitionVote from '../../modules/showcase/competitionVote.model.js';
import ContactRequest from '../../modules/showcase/contactRequest.model.js';
import Follow from '../../modules/showcase/follow.model.js';
import PageView from '../../modules/showcase/pageView.model.js';
import PublicComment from '../../modules/showcase/publicComment.model.js';
import ShowcasePage from '../../modules/showcase/showcasePage.model.js';
import Vote from '../../modules/showcase/vote.model.js';
import { cairoDayString, daysAgo, daysFromNow, sha256 } from './helpers.js';

export async function seedShowcaseAndAudit(ctx) {
  const { university, colleges, users, projects, ideas, defenses } = ctx;

  // 1. Showcase Mini-Sites (8 Published + 1 Pending Approval + 1 Draft)
  const publishedKeys = [
    'retinaAi',
    'robotArm',
    'solarGrid',
    'finHub',
    'medWaste',
    'waterRobot',
    'diabetesCds',
    'crowdfund',
  ];

  const showcaseConfigs = {
    retinaAi: {
      state: SHOWCASE_STATES.PUBLISHED,
      everApproved: true,
      template: SHOWCASE_TEMPLATES.MODERN,
      theme: SHOWCASE_THEMES.NAVY_GOLD,
      slogan: 'رؤية ذكية تحمي البصر قبل فوات الأوان',
      features: [
        'تصنيف فوري لـ 5 درجات من اعتلال الشبكية السكري بدقة 95.4%',
        'خرائط حرارية تفسيرية Grad-CAM لدعم ثقة الطبيب المعالج',
        'تصدير تقارير طبية عربية وإنجليزية بصيغة PDF',
        'دعم العمل مع عدسات تصوير قاع العين المحمولة للقوافل الطبية',
      ],
      technologies: ['Python', 'PyTorch', 'ConvNeXt', 'FastAPI', 'React', 'MongoDB'],
      components: ['عدسة فحص قاع عين 20D', 'خادم GPU للاستدلال السحابي', 'جهاز عرض سريري'],
      video: { kind: LINK_KINDS.YOUTUBE, url: 'https://www.youtube.com/watch?v=aircAruvnKk', title: 'عرض منصة تشخيص شبكية العين' },
      achievements: [
        'المركز الأول في يوم الابتكار الصحي بجامعة المنصورة الأهلية 2026',
        'تقييم سريري مشترك مع كلية الطب بنسبة توافق 94% مع أخصائيي الرمد',
      ],
      interest: 'نرحب بالتعاون مع المستشفيات، مراكز العيون، وشركات التقنيات الطبية لتوسيع الاختبار السريري وإطلاق النسخة التجارية.',
    },
    robotArm: {
      state: SHOWCASE_STATES.PUBLISHED,
      everApproved: true,
      template: SHOWCASE_TEMPLATES.CLASSIC,
      theme: SHOWCASE_THEMES.DEEP_NAVY_SLATE,
      slogan: 'تأهيل ذكي يستعيد الأمل والحركة بتكلفة محلية',
      features: [
        'تحكم تكيّفي يقرأ نية الحركة من الإشارات العضلية السطحية EMG',
        'هيكل خفيف مطبوع بتقنية 3D Carbon-PLA قابل للتخصيص لكل مريض',
        'حدود أمان ميكانيكية وبرمجية تحمي المفاصل أثناء التمرين',
        'لوحة متابعة رقمية لقياس تحسن مدى الحركة أسبوعياً',
      ],
      technologies: ['STM32', 'Embedded C++', 'ROS2', 'MATLAB', 'SolidWorks'],
      components: ['متحكم STM32F407', 'حساسات MyoWare 2.0 EMG', 'محركات سيرفو 35kg.cm', 'هيكل Carbon-PLA'],
      video: { kind: LINK_KINDS.YOUTUBE, url: 'https://www.youtube.com/watch?v=fn3KWM1kuAw', title: 'اختبار الذراع الروبوتية لإعادة التأهيل' },
      achievements: [
        'تخفيض تكلفة التصنيع بنسبة 80% مقارنة بالأجهزة المستوردة',
        'ترشيح للمشاركة في معرض Cairo ICT للابتكار الطلابي',
      ],
      interest: 'نبحث عن شريك صناعي لتصنيع الدفعة التجريبية الأولى والتعاون مع مراكز العلاج الطبيعي في الدلتا.',
    },
    solarGrid: {
      state: SHOWCASE_STATES.PUBLISHED,
      everApproved: true,
      template: SHOWCASE_TEMPLATES.MODERN,
      theme: SHOWCASE_THEMES.WARM_IVORY_NAVY,
      slogan: 'نحو حرم جامعي ذكي ومستدام بجامعة المنصورة الأهلية',
      features: [
        'مراقبة لحظية لإنتاج الألواح وحالة بطاريات LiFePO4 عبر لوحة SCADA',
        'تنبؤ ذكي بالإنتاج الشمسي خلال 24 ساعة باستخدام بيانات الأرصاد',
        'موازنة تلقائية للأحمال وتقليل ذروة الاستهلاك بنسبة 25%',
        'تنبيهات فورية عند انخفاض كفاءة الألواح بسبب الأتربة أو الأعطال',
      ],
      technologies: ['ESP32', 'MQTT', 'Node.js', 'React', 'Python', 'SCADA'],
      components: ['ألواح شمسية أحادية البلورة', 'عاكس MPPT هجين', 'بطاريات LiFePO4', 'حساسات INA226'],
      achievements: [
        'تطبيق تجريبي ناجح على نموذج مبنى كلية الهندسة بجامعة المنصورة الأهلية',
        'إرشاد صناعي مباشر من شركة إيجي سولار للطاقة',
      ],
      interest: 'جاهزون للتوسع بالتعاون مع شركات الطاقة المتجددة وإدارات المدن الذكية الجديدة.',
    },
    finHub: {
      state: SHOWCASE_STATES.PUBLISHED,
      everApproved: true,
      template: SHOWCASE_TEMPLATES.MINIMAL,
      theme: SHOWCASE_THEMES.NAVY_GOLD,
      slogan: 'من فكرة طلابية إلى شركة ناشئة جاهزة للاستثمار',
      features: [
        'محرك دراسة جدوى وتدفقات نقدية تفاعلي باللغة العربية',
        'دليل ذكي لمطابقة رواد الأعمال مع المستثمرين والحاضنات بالدلتا',
        'قوالب جاهزة لعروض المستثمرين ومؤشرات التقييم المالي',
      ],
      technologies: ['React', 'Node.js', 'MongoDB', 'Recharts', 'Tailwind CSS'],
      components: ['محرك النمذجة المالية', 'بوابة المستثمرين', 'تقارير الجدوى التلقائية'],
      achievements: [
        'تجربة ناجحة مع 35 فريقاً طلابياً في كلية الاقتصاد والعلوم الإدارية',
      ],
      interest: 'نرحب بشراكات حاضنات الأعمال، البنوك الداعمة للمشروعات الصغيرة، وصناديق الاستثمار البذري.',
    },
    medWaste: {
      state: SHOWCASE_STATES.PUBLISHED,
      everApproved: true,
      template: SHOWCASE_TEMPLATES.CLASSIC,
      theme: SHOWCASE_THEMES.NAVY_GOLD,
      slogan: 'تتبع آمن وشفاف للمخلفات الطبية من المصدر حتى التعقيم',
      features: [
        'حاويات ذكية تقيس الوزن والامتلاء وتوثق التسليم ببطاقات RFID',
        'سجل تدقيق بيئي إلكتروني متوافق مع اشتراطات وزارة الصحة',
        'تحسين مسارات سيارات الجمع لتقليل التكلفة التشغيلية',
      ],
      technologies: ['ESP32', 'RFID', 'Node.js', 'React', 'MongoDB'],
      components: ['قارئ RFID RC522', 'حساسات وزن Load Cell', 'وحدة تحكم ESP32'],
      achievements: [
        'المركز الأول على مستوى كلية الصيدلة للعام الأكاديمي 2025/2026',
        'تقدير ممتاز بنسبة 94.5% من لجنة المناقشة',
      ],
      interest: 'متاح للشراكة مع المستشفيات الخاصة وشركات إدارة المخلفات الطبية المعتمدة.',
    },
    waterRobot: {
      state: SHOWCASE_STATES.PUBLISHED,
      everApproved: true,
      template: SHOWCASE_TEMPLATES.MODERN,
      theme: SHOWCASE_THEMES.DEEP_NAVY_SLATE,
      slogan: 'حماية كل قطرة ماء بتقنيات الروبوتات والموجات فوق الصوتية',
      features: [
        'فحص داخلي غير متلف لشبكات مياه الشرب دون حفر عشوائي',
        'تحديد دقيق لمواقع التسرب والشروخ بدقة أقل من 15 سم',
        'بث فيديو مباشر وتخزين خريطة الأعطال لفرق الصيانة',
      ],
      technologies: ['C++', 'Python', 'Ultrasonic DSP', 'SolidWorks', 'OpenCV'],
      components: ['هيكل مقاوم للماء IP68', 'حساسات موجات فوق صوتية', 'كاميرا فحص IP'],
      achievements: [
        'جائزة أفضل نموذج هندسي تطبيقي 2025/2026 — كلية الهندسة',
      ],
      interest: 'نرحب بالتعاون مع شركات مياه الشرب وهيئات المجتمعات العمرانية الجديدة.',
    },
    diabetesCds: {
      state: SHOWCASE_STATES.PUBLISHED,
      everApproved: true,
      template: SHOWCASE_TEMPLATES.MINIMAL,
      theme: SHOWCASE_THEMES.WARM_IVORY_NAVY,
      slogan: 'قرارات علاجية أدق لمرضى السكري مدعومة بالبيانات السريرية',
      features: [
        'تحليل تاريخي لمؤشرات HbA1c ووظائف الكلى وتنبيه مبكر للمضاعفات',
        'توصيات إرشادية متوافقة مع أحدث إرشادات ADA العالمية',
      ],
      technologies: ['Python', 'Scikit-learn', 'React', 'FastAPI'],
      components: ['محرك التنبؤ السريري', 'لوحة طبيب الباطنة والغدد'],
      achievements: [
        'تقييم بحثي متميز على بيانات 400 حالة سريرية بمستشفيات المنصورة',
      ],
      interest: 'مفتوح للتعاون البحثي المشترك مع كليات الطب ومراكز أبحاث السكري.',
    },
    crowdfund: {
      state: SHOWCASE_STATES.PUBLISHED,
      everApproved: true,
      template: SHOWCASE_TEMPLATES.CLASSIC,
      theme: SHOWCASE_THEMES.WARM_IVORY_NAVY,
      slogan: 'تمكين الحرفيين والمبتكرين الشباب بالدقهلية عبر التمويل المجتمعي',
      features: [
        'إطلاق حملات تمويل جماعي بنظام المراحل والشفافية الكاملة',
        'دعم الحرف اليدوية والمشاريع الطلابية للوصول لأول عملائها',
      ],
      technologies: ['React', 'Node.js', 'MongoDB'],
      components: ['بوابة الحملات', 'نظام التحقق والمكافآت'],
      achievements: [
        'تجربة مجتمعية مع 12 مشروعاً طلابياً وحرفياً بمدينة المنصورة',
      ],
      interest: 'نتطلع للشراكة مع مؤسسات التمويل متناهي الصغر وجمعيات تنمية المجتمع.',
    },
    pharmaAi: {
      state: SHOWCASE_STATES.PENDING_APPROVAL,
      everApproved: false,
      template: SHOWCASE_TEMPLATES.MODERN,
      theme: SHOWCASE_THEMES.NAVY_GOLD,
      slogan: 'أمان دوائي أذكى لكل مريض بمساعدة الصيدلي الإكلينيكي',
      features: [
        'كشف فوري للتداخلات الدوائية مع الأسماء التجارية في السوق المصري',
        'تعديل الجرعات تلقائياً وفق وظائف الكلى والكبد',
      ],
      technologies: ['Python', 'LangChain', 'FastAPI', 'React'],
      components: ['قاعدة المعرفة الدوائية RAG'],
      achievements: ['اجتياز اختبار التحقق على 150 حالة دوائية مرجعية'],
      interest: 'بانتظار اعتماد المشرف للنشر في معرض كلية الصيدلة.',
    },
    agriDrone: {
      state: SHOWCASE_STATES.DRAFT,
      everApproved: false,
      template: SHOWCASE_TEMPLATES.CLASSIC,
      theme: SHOWCASE_THEMES.DEEP_NAVY_SLATE,
      slogan: 'زراعة دقيقة بالدلتا بعيون ذكية من السماء',
      features: ['مسح جوي تلقائي وحساب مؤشر NDVI لصحة المحاصيل'],
      technologies: ['Pixhawk', 'OpenCV', 'Python', 'Flutter'],
      components: ['Pixhawk 6C', 'Raspberry Pi 5', 'كاميرا NoIR'],
      achievements: [],
      interest: 'جارٍ استكمال صور التجربة الميدانية قبل طلب اعتماد النشر.',
    },
  };

  for (const [key, cfg] of Object.entries(showcaseConfigs)) {
    const proj = projects[key];
    const history = [
      {
        from: SHOWCASE_STATES.DRAFT,
        to: SHOWCASE_STATES.PENDING_APPROVAL,
        event: 'REQUEST_PUBLISH',
        actorId: proj.team.leaderId,
        actorRole: 'student',
        at: daysAgo(14),
      },
    ];
    if (cfg.state === SHOWCASE_STATES.PUBLISHED) {
      history.push({
        from: SHOWCASE_STATES.PENDING_APPROVAL,
        to: SHOWCASE_STATES.PUBLISHED,
        event: 'APPROVE',
        actorId: proj.supervision.primaryId || users.uniAdmin._id,
        actorRole: 'supervisor',
        at: daysAgo(13),
      });
    }

    await ShowcasePage.create({
      projectId: proj._id,
      slug: proj.slug,
      state: cfg.state,
      everApproved: cfg.everApproved,
      template: cfg.template,
      theme: cfg.theme,
      sections: {
        hero: {
          slogan: cfg.slogan,
          ...(proj.cover ? { cover: proj.cover } : {}),
        },
        problem: proj.problem,
        solution: proj.idea,
        features: cfg.features,
        technologies: cfg.technologies,
        components: cfg.components,
        ...(cfg.video ? { video: cfg.video } : {}),
        achievements: cfg.achievements,
        interest: cfg.interest,
      },
      hiddenSections: [],
      history: cfg.state === SHOWCASE_STATES.DRAFT ? [] : history,
      collegeId: proj.collegeId,
      departmentId: proj.departmentId,
    });
  }

  // Set University Featured Projects (Top 4!)
  const featuredIds = [
    projects.retinaAi._id,
    projects.robotArm._id,
    projects.solarGrid._id,
    projects.medWaste._id,
  ];
  await University.updateOne(
    { _id: university._id },
    { $set: { 'settings.featuredProjectIds': featuredIds } }
  );

  // 2. Votes (Valid votes + 3 Flagged votes for moderation queue!)
  const allVoterPool = Object.entries(users)
    .filter(([, u]) => u.status === 'active')
    .map(([, u]) => u);

  const voteTargets = {
    retinaAi: 26,
    robotArm: 21,
    solarGrid: 18,
    medWaste: 16,
    finHub: 14,
    waterRobot: 12,
    diabetesCds: 9,
    crowdfund: 7,
  };

  for (const [pKey, desiredCount] of Object.entries(voteTargets)) {
    const proj = projects[pKey];
    const excluded = new Set([
      ...(proj.activeMemberIds || []).map(String),
      ...(proj.supervisorIds || []).map(String),
    ]);
    const eligibleVoters = allVoterPool.filter((u) => !excluded.has(String(u._id)));
    const selected = eligibleVoters.slice(0, Math.min(desiredCount, eligibleVoters.length));

    let validCount = 0;
    for (let idx = 0; idx < selected.length; idx += 1) {
      const voter = selected[idx];
      // Make 3 votes FLAGGED across top projects so Flagged Votes page has live data!
      const isFlagged =
        (pKey === 'retinaAi' && idx === selected.length - 1) ||
        (pKey === 'robotArm' && idx === selected.length - 1) ||
        (pKey === 'finHub' && idx === selected.length - 1);

      const createdAt = daysAgo(idx % 6, (idx * 3) % 20);
      await Vote.create({
        projectId: proj._id,
        userId: voter._id,
        status: isFlagged ? VOTE_STATUSES.FLAGGED : VOTE_STATUSES.VALID,
        ipHash: sha256(isFlagged ? '196.219.45.100' : `196.219.${idx}.${pKey}`),
        collegeId: proj.collegeId,
        departmentId: proj.departmentId,
        createdAt,
        updatedAt: createdAt,
      });
      if (!isFlagged) validCount += 1;
    }

    await Project.updateOne(
      { _id: proj._id },
      { $set: { 'showcaseStats.validVotes': validCount } }
    );
  }

  // 3. PageViews over the last 7 days so views7d & trendingScore are lively and varied!
  const viewTargets = {
    retinaAi: 92,
    robotArm: 74,
    solarGrid: 65,
    finHub: 58,
    medWaste: 49,
    waterRobot: 41,
    diabetesCds: 33,
    crowdfund: 26,
  };
  const pageViewDocs = [];
  for (const [pKey, count] of Object.entries(viewTargets)) {
    const proj = projects[pKey];
    for (let i = 0; i < count; i += 1) {
      const d = daysAgo(i % 7, i % 18);
      pageViewDocs.push({
        projectId: proj._id,
        visitorKey: sha256(`visitor-${pKey}-${i}`),
        day: cairoDayString(d),
        createdAt: d,
      });
    }
  }
  await PageView.insertMany(pageViewDocs);

  // 4. Competitions (2 OPEN live competitions + 1 CLOSED with frozenRanking!)
  const compUniOpen = await Competition.create({
    title: 'مسابقة أفضل مشروع تخرج بجامعة المنصورة الأهلية 2026/2027',
    scopeType: 'university',
    scopeId: null,
    eligibleProjectIds: [
      projects.retinaAi._id,
      projects.robotArm._id,
      projects.solarGrid._id,
      projects.finHub._id,
    ],
    voterRestriction: VOTER_RESTRICTIONS.ALL,
    startsAt: daysAgo(7),
    endsAt: daysFromNow(21),
    state: COMPETITION_STATES.OPEN,
    createdBy: users.uniAdmin._id,
  });

  const compEngOpen = await Competition.create({
    title: 'تحدي الابتكار الهندسي — كلية الهندسة MNU 2026/2027',
    scopeType: 'college',
    scopeId: colleges.eng._id,
    collegeId: colleges.eng._id,
    eligibleProjectIds: [
      projects.retinaAi._id,
      projects.robotArm._id,
      projects.solarGrid._id,
    ],
    voterRestriction: VOTER_RESTRICTIONS.UNIVERSITY_ONLY,
    startsAt: daysAgo(5),
    endsAt: daysFromNow(14),
    state: COMPETITION_STATES.OPEN,
    createdBy: users.engAdmin._id,
  });

  await Competition.create({
    title: 'جائزة التميز البحثي والتطبيقي بجامعة المنصورة الأهلية 2025/2026',
    scopeType: 'university',
    scopeId: null,
    eligibleProjectIds: [
      projects.medWaste._id,
      projects.waterRobot._id,
      projects.diabetesCds._id,
      projects.crowdfund._id,
    ],
    voterRestriction: VOTER_RESTRICTIONS.ALL,
    startsAt: daysAgo(120),
    endsAt: daysAgo(95),
    state: COMPETITION_STATES.CLOSED,
    frozenAt: daysAgo(95),
    frozenRanking: [
      { projectId: projects.medWaste._id, votes: 84, rank: 1 },
      { projectId: projects.waterRobot._id, votes: 71, rank: 2 },
      { projectId: projects.diabetesCds._id, votes: 53, rank: 3 },
      { projectId: projects.crowdfund._id, votes: 39, rank: 4 },
    ],
    createdBy: users.uniAdmin._id,
  });

  // Live CompetitionVotes for the 2 OPEN competitions
  const uniCompPlan = [
    ['retinaAi', 16],
    ['robotArm', 13],
    ['solarGrid', 11],
    ['finHub', 8],
  ];
  for (const [pKey, count] of uniCompPlan) {
    const proj = projects[pKey];
    const excluded = new Set([...(proj.activeMemberIds || []).map(String), ...(proj.supervisorIds || []).map(String)]);
    const voters = allVoterPool.filter((u) => !excluded.has(String(u._id))).slice(0, count);
    for (let i = 0; i < voters.length; i += 1) {
      await CompetitionVote.create({
        competitionId: compUniOpen._id,
        projectId: proj._id,
        userId: voters[i]._id,
        status: VOTE_STATUSES.VALID,
        ipHash: sha256(`comp-uni-${pKey}-${i}`),
        collegeId: proj.collegeId,
        departmentId: proj.departmentId,
      });
    }
  }

  const mnuOnlyVoters = allVoterPool.filter((u) => u.email.endsWith('@mnu.edu.eg'));
  const engCompPlan = [
    ['retinaAi', 12],
    ['solarGrid', 10],
    ['robotArm', 9],
  ];
  for (const [pKey, count] of engCompPlan) {
    const proj = projects[pKey];
    const excluded = new Set([...(proj.activeMemberIds || []).map(String), ...(proj.supervisorIds || []).map(String)]);
    const voters = mnuOnlyVoters.filter((u) => !excluded.has(String(u._id))).slice(0, count);
    for (let i = 0; i < voters.length; i += 1) {
      await CompetitionVote.create({
        competitionId: compEngOpen._id,
        projectId: proj._id,
        userId: voters[i]._id,
        status: VOTE_STATUSES.VALID,
        ipHash: sha256(`comp-eng-${pKey}-${i}`),
        collegeId: proj.collegeId,
        departmentId: proj.departmentId,
      });
    }
  }

  // 5. Investor Follows, Bookmarks, Challenges, and Contact Requests!
  const followPairs = [
    [users.invDelta._id, projects.retinaAi._id],
    [users.invDelta._id, projects.finHub._id],
    [users.invDelta._id, projects.solarGrid._id],
    [users.invNileMed._id, projects.retinaAi._id],
    [users.invNileMed._id, projects.robotArm._id],
    [users.invNileMed._id, projects.medWaste._id],
    [users.invNileMed._id, projects.diabetesCds._id],
    [users.invEgySolar._id, projects.solarGrid._id],
    [users.invEgySolar._id, projects.waterRobot._id],
  ];
  for (const [userId, projectId] of followPairs) {
    await Follow.create({ userId, projectId });
  }

  const bookmarkPairs = [
    [users.invDelta._id, projects.retinaAi._id],
    [users.invDelta._id, projects.finHub._id],
    [users.invNileMed._id, projects.retinaAi._id],
    [users.invNileMed._id, projects.robotArm._id],
    [users.invEgySolar._id, projects.solarGrid._id],
    [users.invEgySolar._id, projects.waterRobot._id],
  ];
  for (const [userId, projectId] of bookmarkPairs) {
    await Bookmark.create({ userId, projectId });
  }

  // Sync follows & bookmarks counts into Project.showcaseStats
  for (const pKey of publishedKeys) {
    const proj = projects[pKey];
    const [followsCount, bookmarksCount] = await Promise.all([
      Follow.countDocuments({ projectId: proj._id }),
      Bookmark.countDocuments({ projectId: proj._id }),
    ]);
    await Project.updateOne(
      { _id: proj._id },
      { $set: { 'showcaseStats.follows': followsCount, 'showcaseStats.bookmarks': bookmarksCount } }
    );
  }

  // Industry Challenges (5 realistic Egyptian industry challenges)
  await Challenge.create([
    {
      investorId: users.invNileMed._id,
      title: 'تطوير جهاز محمول لفرز حالات اعتلال الشبكية السكري بالعيادات الريفية',
      description: 'نبحث عن حل متكامل يجمع بين عدسة تصوير منخفضة التكلفة ونموذج ذكاء اصطناعي يعمل دون إنترنت (Edge AI) لدعم القوافل الطبية بمحافظة الدقهلية.',
      field: 'ai',
      status: CHALLENGE_STATUSES.OPEN,
      ideaId: ideas.ideaWearableEcg._id,
    },
    {
      investorId: users.invEgySolar._id,
      title: 'تحسين كفاءة الألواح الشمسية ومراقبة التبريد بالمباني الجامعية الساحلية',
      description: 'تحدٍّ هندسي لتقليل فاقد الحرارة والغبار على المحطات الشمسية في المدن الساحلية مثل المنصورة الجديدة وجمصة باستخدام مستشعرات IoT.',
      field: 'renewable_energy',
      status: CHALLENGE_STATUSES.CLOSED,
      ideaId: ideas.ideaSolar._id,
    },
    {
      investorId: users.invDelta._id,
      title: 'منصة تقييم ائتماني بديل للمشروعات متناهية الصغر بالدلتا',
      description: 'تصميم خوارزمية تقييم مالي تعتمد على بيانات المبيعات الرقمية والتدفقات الشهرية لتمكين أصحاب الورش والمتاجر الصغيرة من الحصول على تمويل سريع.',
      field: 'business_fintech',
      status: CHALLENGE_STATUSES.OPEN,
    },
    {
      investorId: users.invDelta._id,
      title: 'حل ذكي للتنبؤ بآفات محصول الأرز وتقنين مياه الري باستخدام صور الأقمار الصناعية',
      description: 'نرحب بأفكار طلاب الهندسة وعلوم البيانات لتطوير نظام إنذار مبكر يخدم مزارعي الدقهلية ودمياط.',
      field: 'data_science',
      status: CHALLENGE_STATUSES.OPEN,
      ideaId: ideas.ideaDeltaAgri._id,
    },
    {
      investorId: users.invNileMed._id,
      title: 'مراقبة ذكية لالتزام مرضى الأمراض المزمنة بجرعات الدواء',
      description: 'تصميم علبة دواء ذكية متصلة بتطبيق هاتف لتنبيه المرضى كبار السن وذويهم وتقليل حالات إعادة الدخول للمستشفى.',
      field: 'iot_embedded',
      status: CHALLENGE_STATUSES.OPEN,
    },
  ]);

  // Contact Requests (accepted with shared contacts, pending, declined)
  await ContactRequest.create([
    {
      projectId: projects.retinaAi._id,
      investorId: users.invNileMed._id,
      message: 'أُعجبنا كثيراً بدقة نموذج تشخيص شبكية العين وخرائط Grad-CAM. نود ترتيب اجتماع تعريفي مع الفريق لبحث رعاية التجارب السريرية وتمويل النسخة الإنتاجية.',
      state: CONTACT_REQUEST_STATES.ACCEPTED,
      reply: {
        text: 'يسعدنا جداً التواصل مع النيل للتقنيات الطبية! نحن جاهزون لعرض تجريبي مباشر في أي وقت يناسبكم هذا الأسبوع.',
        sharedContacts: {
          email: 'sara@mnu.edu.eg',
          phone: '+201020260001',
          other: 'قائد الفريق — كلية الهندسة، جامعة المنصورة الأهلية',
        },
      },
      decidedBy: users.stSara._id,
      decidedAt: daysAgo(4),
      collegeId: projects.retinaAi.collegeId,
      departmentId: projects.retinaAi.departmentId,
    },
    {
      projectId: projects.finHub._id,
      investorId: users.invDelta._id,
      message: 'بوابة MNU FinHub تتماشى تماماً مع برنامج احتضان الشركات الناشئة في دلتا فنتشرز. نرغب في مناقشة شراكة استراتيجية ودعم الإطلاق.',
      state: CONTACT_REQUEST_STATES.PENDING,
      collegeId: projects.finHub.collegeId,
      departmentId: projects.finHub.departmentId,
    },
    {
      projectId: projects.robotArm._id,
      investorId: users.invNileMed._id,
      message: 'نود معاينة النموذج الميكانيكي للذراع الروبوتية ومناقشة إمكانية دعم تصنيع نسخة مطورة للتجارب داخل مراكز التأهيل.',
      state: CONTACT_REQUEST_STATES.PENDING,
      collegeId: projects.robotArm.collegeId,
      departmentId: projects.robotArm.departmentId,
    },
    {
      projectId: projects.solarGrid._id,
      investorId: users.invEgySolar._id,
      message: 'نرغب في استضافة الفريق بمقر الشركة لمناقشة دمج لوحة SCADA في أحد مشروعات الطاقة الشمسية التجارية بالمنصورة الجديدة.',
      state: CONTACT_REQUEST_STATES.ACCEPTED,
      reply: {
        text: 'شكراً لدعمكم المستمر! تم التنسيق مع د. كريم المنشاوي ونتشرف بزيارة مقر الشركة الأسبوع المقبل.',
        sharedContacts: {
          email: 'mazen.eleissawy@mnu.edu.eg',
          phone: '+201020260020',
        },
      },
      decidedBy: users.stMazen._id,
      decidedAt: daysAgo(2),
      collegeId: projects.solarGrid.collegeId,
      departmentId: projects.solarGrid.departmentId,
    },
    {
      projectId: projects.crowdfund._id,
      investorId: users.invDelta._id,
      message: 'هل يخطط الفريق لإطلاق نسخة تجارية من منصة التمويل الجماعي؟',
      state: CONTACT_REQUEST_STATES.DECLINED,
      reply: {
        text: 'شكراً لاهتمامكم، المشروع حالياً في مرحلة بحثية ومؤرشف للعام السابق ولن يُطرح تجارياً هذا العام.',
      },
      decidedBy: users.stPrev7._id,
      decidedAt: daysAgo(30),
      collegeId: projects.crowdfund.collegeId,
      departmentId: projects.crowdfund.departmentId,
    },
  ]);

  // 6. Public Comments on Showcase Mini-Sites (with replies & 2 reported comments for moderation!)
  const pubCommentsSpec = [
    ['retinaAi', users.visNada._id, 'مشروع مشرف جداً لجامعة المنصورة الأهلية! فكرة الخرائط الحرارية التفسيرية ستساعد الأطباء كثيراً في العيادات.', false],
    ['retinaAi', users.invNileMed._id, 'عمل هندسي وطبي متكامل يعكس قيمة التعاون بين كلية الهندسة وكلية الطب البشري.', false],
    ['retinaAi', users.visHazem._id, 'هل يعمل النظام على صور الهواتف المحمولة العادية أم يحتاج عدسة طبية مخصصة؟', false],
    ['robotArm', users.visDina._id, 'فكرة رائعة وإنسانية جداً، تقليل التكلفة بنسبة 80% إنجاز حقيقي يستحق الدعم.', false],
    ['robotArm', users.visKarim._id, 'تصميم الهيكل خفيف الوزن والاعتماد على إشارات EMG نقلة نوعية في مشاريع الهندسة الطبية.', false],
    ['solarGrid', users.invEgySolar._id, 'تطبيق ذكي جداً ومناسب تماماً لمناخ مدينة المنصورة الجديدة، بالتوفيق في المناقشة!', false],
    ['solarGrid', users.visNada._id, 'لوحة المراقبة والتنبؤ بالأحمال منظمة وواضحة جداً.', false],
    ['finHub', users.visHazem._id, 'كطالب مهتم بريادة الأعمال أتمنى إطلاق المنصة رسمياً لكل طلاب الدقهلية قريباً.', false],
    ['finHub', users.visKarim._id, 'تعليق تجريبي مكرر للترويج لصفحة خارجية غير ذات صلة بالمشروع.', true],
    ['medWaste', users.visDina._id, 'مشروع مهم جداً للسلامة البيئية في المستشفيات، مبروك المركز الأول!', false],
    ['waterRobot', users.visKarim._id, 'فكرة عملية ممتازة لمشكلة حقيقية في شبكات المياه.', false],
    ['diabetesCds', users.visNada._id, 'الاعتماد على إرشادات ADA العالمية يمنح النظام موثوقية علمية عالية.', false],
    ['crowdfund', users.visHazem._id, 'أتمنى رؤية مزيد من المشاريع الداعمة للحرفيين في الدقهلية.', true],
  ];

  for (const [pKey, authorId, text, isReported] of pubCommentsSpec) {
    const proj = projects[pKey];
    const c = await PublicComment.create({
      projectId: proj._id,
      authorId,
      text,
      state: PUBLIC_COMMENT_STATES.VISIBLE,
      reports: isReported
        ? [{ userId: users.visNada._id, reason: 'محتوى غير ملائم أو دعائي خارج سياق المشروع.', at: daysAgo(1) }]
        : [],
      collegeId: proj.collegeId,
      departmentId: proj.departmentId,
      createdAt: daysAgo(Math.floor(Math.random() * 8) + 1),
    });
    if (pKey === 'retinaAi' && authorId === users.visHazem._id) {
      await PublicComment.create({
        projectId: proj._id,
        authorId: users.stSara._id,
        parentId: c._id,
        text: 'شكراً لسؤالك! يعمل النظام مع صور أجهزة Fundus القياسية وكذلك مع عدسة محمولة 20D تُركّب على الهاتف الذكي للقوافل الطبية.',
        state: PUBLIC_COMMENT_STATES.VISIBLE,
        collegeId: proj.collegeId,
        departmentId: proj.departmentId,
        createdAt: daysAgo(2),
      });
    }
  }

  // 7. Notifications using EXACT ar.js i18n keys!
  await Notification.create([
    {
      userId: users.stSara._id,
      type: 'grades_finalized',
      titleKey: 'notifications.gradesFinalizedTitle',
      bodyKey: 'notifications.gradesFinalizedBody',
      vars: { project: projects.retinaAi.title },
      link: `/projects/${projects.retinaAi._id}/grades`,
      readAt: daysAgo(10),
    },
    {
      userId: users.stSara._id,
      type: 'showcase_approved',
      titleKey: 'notifications.showcaseApprovedTitle',
      bodyKey: 'notifications.showcaseApprovedBody',
      vars: { project: projects.retinaAi.title },
      link: `/p/${projects.retinaAi.slug}`,
      readAt: null,
    },
    {
      userId: users.stSara._id,
      type: 'contact_request_received',
      titleKey: 'notifications.contactRequestReceivedTitle',
      bodyKey: 'notifications.contactRequestReceivedBody',
      vars: { project: projects.retinaAi.title },
      link: `/projects/${projects.retinaAi._id}`,
      readAt: null,
    },
    {
      userId: users.supTarek._id,
      type: 'defense_scheduled',
      titleKey: 'notifications.defenseScheduledTitle',
      bodyKey: 'notifications.defenseScheduledBody',
      vars: { project: projects.solarGrid.title, date: daysFromNow(10).toLocaleDateString('ar-EG') },
      link: `/defenses/${defenses.solarGrid.defense._id}`,
      readAt: null,
    },
    {
      userId: users.supTarek._id,
      type: 'chat_mention',
      titleKey: 'notifications.mentionedInChat',
      bodyKey: 'notifications.mentionedInChat',
      vars: { project: projects.retinaAi.title },
      link: '/chat',
      readAt: null,
    },
    {
      userId: users.supYasser._id,
      type: 'showcase_publish_requested',
      titleKey: 'notifications.showcasePublishRequestedTitle',
      bodyKey: 'notifications.showcasePublishRequestedBody',
      vars: { project: projects.pharmaAi.title },
      link: `/projects/${projects.pharmaAi._id}/showcase`,
      readAt: null,
    },
    {
      userId: users.uniAdmin._id,
      type: 'reeval_requested',
      titleKey: 'notifications.reevalRequestedTitle',
      bodyKey: 'notifications.reevalRequestedBody',
      vars: { project: projects.diabetesCds.title },
      link: '/reevaluations',
      readAt: null,
    },
    {
      userId: users.medAdmin._id,
      type: 'reeval_requested',
      titleKey: 'notifications.reevalRequestedTitle',
      bodyKey: 'notifications.reevalRequestedBody',
      vars: { project: projects.diabetesCds.title },
      link: '/reevaluations',
      readAt: null,
    },
    {
      userId: users.invNileMed._id,
      type: 'contact_request_decided',
      titleKey: 'notifications.contactRequestDecidedTitle',
      bodyKey: 'notifications.contactRequestDecidedBody',
      vars: { project: projects.retinaAi.title, status: 'مقبول' },
      link: '/investor',
      readAt: null,
    },
    {
      userId: users.stKareemB._id,
      type: 'contact_request_received',
      titleKey: 'notifications.contactRequestReceivedTitle',
      bodyKey: 'notifications.contactRequestReceivedBody',
      vars: { project: projects.finHub.title },
      link: `/projects/${projects.finHub._id}`,
      readAt: null,
    },
  ]);

  // 8. Audit Logs (rich realistic governance & activity history)
  const auditEntries = [
    [users.uniAdmin, 'universityAdmin', 'org.college.create', 'College', colleges.eng._id, { collegeId: colleges.eng._id }, 'إنشاء كلية الهندسة بالهيكل التنظيمي لجامعة المنصورة الأهلية', 110],
    [users.uniAdmin, 'universityAdmin', 'org.college.create', 'College', colleges.bus._id, { collegeId: colleges.bus._id }, 'إنشاء كلية الاقتصاد والعلوم الإدارية', 110],
    [users.uniAdmin, 'universityAdmin', 'org.college.create', 'College', colleges.phm._id, { collegeId: colleges.phm._id }, 'إنشاء كلية الصيدلة', 109],
    [users.uniAdmin, 'universityAdmin', 'org.college.create', 'College', colleges.med._id, { collegeId: colleges.med._id }, 'إنشاء كلية الطب البشري', 109],
    [users.uniAdmin, 'universityAdmin', 'org.college.create', 'College', colleges.nur._id, { collegeId: colleges.nur._id }, 'إنشاء كلية التمريض', 108],
    [users.uniAdmin, 'universityAdmin', 'auth.investor.approve', 'User', users.invDelta._id, {}, 'اعتماد حساب دلتا فنتشرز كشريك استثماري معتمد', 55],
    [users.uniAdmin, 'universityAdmin', 'auth.investor.approve', 'User', users.invNileMed._id, {}, 'اعتماد حساب النيل للتقنيات الطبية', 48],
    [users.uniAdmin, 'universityAdmin', 'auth.investor.approve', 'User', users.invEgySolar._id, {}, 'اعتماد حساب إيجي سولار للطاقة', 40],
    [users.engAdmin, 'collegeAdmin', 'project.proposal.approve', 'Project', projects.retinaAi._id, { collegeId: colleges.eng._id, projectId: projects.retinaAi._id }, 'اعتماد مقترح منصة التشخيص المبكر لشبكية العين', 77],
    [users.engAdmin, 'collegeAdmin', 'project.supervision.assign', 'Project', projects.retinaAi._id, { collegeId: colleges.eng._id, projectId: projects.retinaAi._id }, 'تعيين د. طارق السعيد مشرفاً أساسياً ود. سلوى الشناوي مشرفاً مشاركاً', 76],
    [users.engAdmin, 'collegeAdmin', 'project.proposal.approve', 'Project', projects.robotArm._id, { collegeId: colleges.eng._id, projectId: projects.robotArm._id }, 'اعتماد مقترح الذراع الروبوتية لإعادة التأهيل', 75],
    [users.engAdmin, 'collegeAdmin', 'project.proposal.approve', 'Project', projects.solarGrid._id, { collegeId: colleges.eng._id, projectId: projects.solarGrid._id }, 'اعتماد مقترح الشبكات الشمسية الذكية لحرم الجامعة', 74],
    [users.busAdmin, 'collegeAdmin', 'project.proposal.approve', 'Project', projects.finHub._id, { collegeId: colleges.bus._id, projectId: projects.finHub._id }, 'اعتماد بوابة MNU FinHub لريادة الأعمال', 70],
    [users.phmAdmin, 'collegeAdmin', 'project.proposal.approve', 'Project', projects.pharmaAi._id, { collegeId: colleges.phm._id, projectId: projects.pharmaAi._id }, 'اعتماد مساعد الصيدلي الإكلينيكي الذكي', 68],
    [users.engAdmin, 'collegeAdmin', 'evaluation.defense.schedule', 'Defense', defenses.retinaAi.defense._id, { collegeId: colleges.eng._id, projectId: projects.retinaAi._id }, 'جدولة المناقشة النهائية وتشكيل اللجنة المستقلة', 22],
    [users.extAbulnaga, 'committeeMember', 'evaluation.grades.finalize', 'Defense', defenses.retinaAi.defense._id, { collegeId: colleges.eng._id, projectId: projects.retinaAi._id }, 'اعتماد الدرجات النهائية لمشروع تشخيص شبكية العين', 11],
    [users.supTarek, 'supervisor', 'showcase.page.approve', 'ShowcasePage', projects.retinaAi._id, { collegeId: colleges.eng._id, projectId: projects.retinaAi._id }, 'اعتماد نشر الصفحة العامة في معرض جامعة المنصورة الأهلية', 13],
    [users.uniAdmin, 'universityAdmin', 'showcase.featured.update', 'University', university._id, {}, 'اختيار 4 مشاريع رائدة للعرض المميز بالصفحة الرئيسية للمنصة', 8],
    [users.uniAdmin, 'universityAdmin', 'showcase.competition.create', 'Competition', compUniOpen._id, {}, 'إطلاق مسابقة أفضل مشروع تخرج بجامعة المنصورة الأهلية 2026/2027', 7],
    [users.engAdmin, 'collegeAdmin', 'showcase.competition.create', 'Competition', compEngOpen._id, { collegeId: colleges.eng._id }, 'إطلاق تحدي الابتكار الهندسي بكلية الهندسة', 5],
    [users.engAdmin, 'collegeAdmin', 'evaluation.defense.schedule', 'Defense', defenses.solarGrid.defense._id, { collegeId: colleges.eng._id, projectId: projects.solarGrid._id }, 'جدولة مناقشة مشروع الشبكات الشمسية الذكية', 2],
  ];

  await AuditLog.insertMany(
    auditEntries.map(([actor, actorRole, action, targetType, targetId, scope, reason, dAgo]) => ({
      actorId: actor._id,
      actorRole,
      action,
      targetType,
      targetId,
      scope: {
        collegeId: scope.collegeId || null,
        departmentId: scope.departmentId || null,
        projectId: scope.projectId || null,
      },
      reason,
      ipHash: sha256('10.20.30.1'),
      at: daysAgo(dAgo),
    }))
  );

  // 9. Run the REAL platform jobs to compute trending scores & warm ALL StatsCache reports!
  const trendingResult = await runTrendingJob();
  const statsResult = await runRecalcStatsJob();

  return { trendingResult, statsResult };
}

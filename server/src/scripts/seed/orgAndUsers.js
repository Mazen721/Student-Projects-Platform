import {
  ACADEMIC_YEAR_STATUSES,
  ACCOUNT_TYPES,
  INVITATION_KINDS,
  PHASE_TEMPLATE_STATUSES,
  PRIVACY_VISIBILITY,
  ROLES,
  RUBRIC_CRITERION_TARGETS,
  RUBRIC_STATUSES,
  SCOPE_TYPES,
  USER_STATUSES,
} from '@spp/shared/constants';
import { hashPassword } from '../../core/auth/tokens.js';
import Invitation from '../../modules/auth/invitation.model.js';
import User from '../../modules/auth/user.model.js';
import Rubric from '../../modules/evaluation/rubric.model.js';
import AcademicYear from '../../modules/organization/academicYear.model.js';
import College from '../../modules/organization/college.model.js';
import Department from '../../modules/organization/department.model.js';
import University from '../../modules/organization/university.model.js';
import PhaseTemplate from '../../modules/tracking/phaseTemplate.model.js';
import {
  SEED_IMAGES,
  backdateCreatedAt,
  daysAgo,
  daysFromNow,
  makeDocRef,
  makeImageRef,
  sha256,
} from './helpers.js';

export const DEMO_PASSWORD = 'Demo1234!';

const COLLEGES_SPEC = [
  {
    key: 'eng',
    name: 'كلية الهندسة',
    code: 'ENG',
    settings: { teamSizeMin: 2, teamSizeMax: 5, allowCrossCollege: true, supervisorPrimaryCap: 5, passMark: 60 },
    departments: [
      { key: 'aie', name: 'هندسة الذكاء الاصطناعي', code: 'AIE' },
      { key: 'cce', name: 'هندسة الاتصالات والحاسبات', code: 'CCE' },
      { key: 'mct', name: 'هندسة الميكاترونكس', code: 'MCT' },
      { key: 'bme', name: 'الهندسة الطبية الحيوية', code: 'BME' },
      { key: 'sar', name: 'هندسة العمارة المستدامة', code: 'SAR' },
    ],
  },
  {
    key: 'bus',
    name: 'كلية الاقتصاد والعلوم الإدارية',
    code: 'BUS',
    settings: { teamSizeMin: 2, teamSizeMax: 5, allowCrossCollege: true, supervisorPrimaryCap: 6, passMark: 60 },
    departments: [
      { key: 'een', name: 'ريادة الأعمال الإلكترونية', code: 'EEN' },
      { key: 'dmo', name: 'التسويق الرقمي والعمليات الإلكترونية', code: 'DMO' },
      { key: 'ecf', name: 'الاقتصاد والتمويل', code: 'ECF' },
    ],
  },
  {
    key: 'phm',
    name: 'كلية الصيدلة',
    code: 'PHM',
    settings: { teamSizeMin: 2, teamSizeMax: 5, allowCrossCollege: true, supervisorPrimaryCap: 5, passMark: 60 },
    departments: [
      { key: 'cph', name: 'الصيدلة الإكلينيكية (Pharm-D)', code: 'CPH' },
      { key: 'pht', name: 'التكنولوجيا الصيدلية', code: 'PHT' },
    ],
  },
  {
    key: 'med',
    name: 'كلية الطب البشري',
    code: 'MED',
    settings: { teamSizeMin: 2, teamSizeMax: 5, allowCrossCollege: true, supervisorPrimaryCap: 5, passMark: 60 },
    departments: [{ key: 'mbbs', name: 'الطب والجراحة العامة', code: 'MBBS' }],
  },
  {
    key: 'nur',
    name: 'كلية التمريض',
    code: 'NUR',
    settings: { teamSizeMin: 2, teamSizeMax: 4, allowCrossCollege: false, supervisorPrimaryCap: 5, passMark: 60 },
    departments: [{ key: 'ccn', name: 'تمريض العناية الحرجة والطوارئ', code: 'CCN' }],
  },
];

function buildDefaultPhaseDefs(collegeCode) {
  return [
    {
      key: 'analysis',
      name: 'المرحلة الأولى: تحليل المتطلبات ودراسة الجدوى',
      order: 1,
      weight: 20,
      dueOffsetDays: 30,
      requiredDeliverables: [
        {
          key: 'srs_doc',
          title: 'وثيقة تحليل المتطلبات والدراسة المرجعية',
          description: 'توصيف كامل للمشكلة، الدراسة المقارنة للأنظمة المماثلة، والمتطلبات الوظيفية وغير الوظيفية.',
          allowedTypes: ['pdf', 'docx'],
        },
      ],
      forms: [
        makeDocRef(`form-${collegeCode.toLowerCase()}-p1`, 'نموذج-تحليل-المتطلبات-MNU.pdf', 'pdf', 320400),
      ],
    },
    {
      key: 'design',
      name: 'المرحلة الثانية: التصميم المعماري والهندسي',
      order: 2,
      weight: 25,
      dueOffsetDays: 65,
      requiredDeliverables: [
        {
          key: 'architecture_doc',
          title: 'مستند التصميم المعماري والمخططات الفنية',
          description: 'مخططات النظام، قاعدة البيانات أو الدوائر الإلكترونية، وتصميم واجهات المستخدم.',
          allowedTypes: ['pdf', 'docx', 'pptx'],
        },
        {
          key: 'midpoint_slides',
          title: 'عرض منتصف المشروع',
          description: 'عرض تقديمي يوضح التقدم الفني وخطة التنفيذ للنموذج الأولي.',
          allowedTypes: ['pdf', 'pptx'],
        },
      ],
      forms: [
        makeDocRef(`form-${collegeCode.toLowerCase()}-p2`, 'قالب-التصميم-المعماري-MNU.docx', 'docx', 214500),
      ],
    },
    {
      key: 'implementation',
      name: 'المرحلة الثالثة: التنفيذ وبناء النموذج الأولي',
      order: 3,
      weight: 35,
      dueOffsetDays: 120,
      requiredDeliverables: [
        {
          key: 'prototype_report',
          title: 'تقرير النموذج الأولي والشفرة المصدرية',
          description: 'توثيق التنفيذ العملي، رابط مستودع GitHub أو فيديو العرض التجريبي للنظام.',
          allowedTypes: ['pdf', 'zip'],
        },
      ],
      forms: [],
    },
    {
      key: 'final_testing',
      name: 'المرحلة الرابعة: الاختبار والتوثيق النهائي',
      order: 4,
      weight: 20,
      dueOffsetDays: 165,
      requiredDeliverables: [
        {
          key: 'final_thesis',
          title: 'الكتاب النهائي للمشروع (Graduation Thesis)',
          description: 'النسخة النهائية المنسقة من كتاب مشروع التخرج متضمنة نتائج الاختبار والتقييم.',
          allowedTypes: ['pdf'],
        },
        {
          key: 'defense_deck',
          title: 'العرض التقديمي للمناقشة النهائية والملصق العلمي',
          description: 'الشرائح النهائية للمناقشة أمام اللجنة والـ Poster التعريفي للمعرض الجامعي.',
          allowedTypes: ['pdf', 'pptx'],
        },
      ],
      forms: [
        makeDocRef(`form-${collegeCode.toLowerCase()}-p4`, 'دليل-تنسيق-كتاب-التخرج-MNU.pdf', 'pdf', 512000),
      ],
    },
  ];
}

function buildRubricCriteria() {
  return [
    {
      key: 'innovation',
      name: 'الأصالة والابتكار وحل المشكلة',
      weight: 20,
      appliesTo: RUBRIC_CRITERION_TARGETS.TEAM,
      maxScore: 100,
    },
    {
      key: 'technical_depth',
      name: 'جودة التنفيذ الفني والهندسي',
      weight: 30,
      appliesTo: RUBRIC_CRITERION_TARGETS.TEAM,
      maxScore: 100,
    },
    {
      key: 'documentation',
      name: 'جودة التوثيق والالتزام بالمراحل',
      weight: 15,
      appliesTo: RUBRIC_CRITERION_TARGETS.TEAM,
      maxScore: 100,
    },
    {
      key: 'presentation',
      name: 'مهارات العرض والإجابة في المناقشة',
      weight: 20,
      appliesTo: RUBRIC_CRITERION_TARGETS.INDIVIDUAL,
      maxScore: 100,
    },
    {
      key: 'individual_contribution',
      name: 'الإسهام الفردي والالتزام الشخصي',
      weight: 15,
      appliesTo: RUBRIC_CRITERION_TARGETS.INDIVIDUAL,
      maxScore: 100,
    },
  ];
}

export async function seedOrgAndUsers() {
  const university = await University.findOneAndUpdate(
    {},
    {
      $set: {
        name: 'جامعة المنصورة الأهلية',
        logo: makeImageRef('mnu-logo', SEED_IMAGES.universityLogo, 'mnu-logo.jpg'),
        settings: {
          allowedEmailDomains: ['mnu.edu.eg', 'mansnu.edu.eg'],
          minVoteAccountAgeHours: 24,
          voteBurstPerIp10m: 15,
          featuredProjectIds: [],
        },
      },
    },
    { upsert: true, new: true }
  );

  const colleges = {};
  const departments = {};
  const years = { prev: {}, curr: {} };
  const templates = {};
  const rubrics = { prev: {}, curr: {} };

  for (const spec of COLLEGES_SPEC) {
    const college = await College.create({
      name: spec.name,
      code: spec.code,
      settings: spec.settings,
    });
    colleges[spec.key] = college;

    for (const d of spec.departments) {
      const dept = await Department.create({
        name: d.name,
        code: d.code,
        collegeId: college._id,
      });
      departments[d.key] = dept;
    }

    // Previous archived year (2025/2026)
    const prevYear = await AcademicYear.create({
      collegeId: college._id,
      label: '2025/2026',
      isCurrent: false,
      status: ACADEMIC_YEAR_STATUSES.ARCHIVED,
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-06-30'),
      semesters: [
        { name: 'الفصل الدراسي الأول', startDate: new Date('2025-09-01'), endDate: new Date('2026-01-20') },
        { name: 'الفصل الدراسي الثاني', startDate: new Date('2026-02-01'), endDate: new Date('2026-06-30') },
      ],
      cycle: {
        registrationOpensAt: new Date('2025-09-10'),
        registrationClosesAt: new Date('2025-11-15'),
        proposalDeadline: new Date('2025-12-01'),
        defenseStart: new Date('2026-05-15'),
        defenseEnd: new Date('2026-06-25'),
      },
    });
    years.prev[spec.key] = prevYear;

    // Current live year (2026/2027) — registration & proposals open right now for demos!
    const currYear = await AcademicYear.create({
      collegeId: college._id,
      label: '2026/2027',
      isCurrent: true,
      status: ACADEMIC_YEAR_STATUSES.ACTIVE,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-06-30'),
      semesters: [
        { name: 'الفصل الدراسي الأول', startDate: new Date('2026-09-01'), endDate: new Date('2027-01-22') },
        { name: 'الفصل الدراسي الثاني', startDate: new Date('2027-02-06'), endDate: new Date('2027-06-30') },
      ],
      cycle: {
        registrationOpensAt: new Date('2026-09-01'),
        registrationClosesAt: new Date('2027-02-28'),
        proposalDeadline: new Date('2027-03-15'),
        defenseStart: new Date('2027-05-15'),
        defenseEnd: new Date('2027-06-25'),
      },
    });
    years.curr[spec.key] = currYear;

    // Default Phase Template for college
    templates[spec.key] = await PhaseTemplate.create({
      collegeId: college._id,
      name: `قالب مراحل مشاريع التخرج — ${spec.name}`,
      isDefault: true,
      status: PHASE_TEMPLATE_STATUSES.ACTIVE,
      phases: buildDefaultPhaseDefs(spec.code),
    });

    // Rubrics for both years
    rubrics.prev[spec.key] = await Rubric.create({
      collegeId: college._id,
      academicYearId: prevYear._id,
      name: `نموذج تقييم مشاريع التخرج 2025/2026 — ${spec.name}`,
      supervisorPct: 40,
      committeePct: 60,
      criteria: buildRubricCriteria(),
      status: RUBRIC_STATUSES.LOCKED,
    });

    rubrics.curr[spec.key] = await Rubric.create({
      collegeId: college._id,
      academicYearId: currYear._id,
      name: `نموذج التقييم المعتمد 2026/2027 — ${spec.name}`,
      supervisorPct: 40,
      committeePct: 60,
      criteria: buildRubricCriteria(),
      status: spec.key === 'eng' ? RUBRIC_STATUSES.LOCKED : RUBRIC_STATUSES.ACTIVE,
    });
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const users = {};

  async function createUser(key, payload, createdDaysAgo = 65) {
    const doc = await User.create({
      passwordHash,
      status: USER_STATUSES.ACTIVE,
      lastLoginAt: daysAgo(Math.floor(Math.random() * 5), Math.floor(Math.random() * 12)),
      ...payload,
    });
    await backdateCreatedAt(User, doc._id, daysAgo(createdDaysAgo));
    users[key] = doc;
    return doc;
  }

  // 1. University Admin
  await createUser('uniAdmin', {
    name: 'أ.د. شريف خاطر',
    email: 'admin@mnu.edu.eg',
    accountType: ACCOUNT_TYPES.STAFF,
    profile: {
      bio: 'إدارة منصة مشاريع التخرج والابتكار الطلابي — جامعة المنصورة الأهلية.',
      skills: ['الإدارة الأكاديمية', 'الحوكمة الرقمية', 'الجودة والاعتماد'],
      phone: '+201001112200',
    },
    roles: [{ role: ROLES.UNIVERSITY_ADMIN, scopeType: SCOPE_TYPES.UNIVERSITY }],
  }, 120);

  // 2. College Admins (Deans / Vice Deans)
  const collegeAdminSpecs = [
    ['engAdmin', 'أ.د. إيهاب عبد الحي', 'eng.admin@mnu.edu.eg', 'eng', 'عميد كلية الهندسة — جامعة المنصورة الأهلية.'],
    ['busAdmin', 'أ.د. حسام الدين مصطفى', 'bus.admin@mnu.edu.eg', 'bus', 'عميد كلية الاقتصاد والعلوم الإدارية — جامعة المنصورة الأهلية.'],
    ['phmAdmin', 'أ.د. رشا بروة', 'phm.admin@mnu.edu.eg', 'phm', 'عميد كلية الصيدلة — جامعة المنصورة الأهلية.'],
    ['medAdmin', 'أ.د. أميرة طمان', 'med.admin@mnu.edu.eg', 'med', 'وكيل كلية الطب البشري لشؤون التعليم والطلاب.'],
    ['nurAdmin', 'أ.د. ناهد قنديل', 'nur.admin@mnu.edu.eg', 'nur', 'عميد كلية التمريض — جامعة المنصورة الأهلية.'],
  ];
  for (const [key, name, email, cKey, bio] of collegeAdminSpecs) {
    const col = colleges[cKey];
    await createUser(key, {
      name,
      email,
      accountType: ACCOUNT_TYPES.STAFF,
      collegeId: col._id,
      profile: { bio, skills: ['القيادة الأكاديمية', 'تطوير المناهج'] },
      roles: [
        { role: ROLES.COLLEGE_ADMIN, scopeType: SCOPE_TYPES.COLLEGE, scopeId: col._id, collegeId: col._id },
      ],
    }, 110);
  }

  // 3. Supervisors & Department Admins (also eligible as Committee Members for non-supervised projects)
  const supervisorSpecs = [
    ['supTarek', 'د. طارق السعيد', 'supervisor@mnu.edu.eg', 'eng', 'aie', true, ['الذكاء الاصطناعي', 'التعلم العميق', 'الرؤية الحاسوبية']],
    ['supHeba', 'د. هبة الله الشربيني', 'heba.elsherbiny@mnu.edu.eg', 'eng', 'cce', true, ['الأمن السيبراني', 'الشبكات الذكية', 'إنترنت الأشياء']],
    ['supKarim', 'د. كريم المنشاوي', 'karim.elmenshawy@mnu.edu.eg', 'eng', 'mct', false, ['الميكاترونكس', 'الروبوتات', 'الطاقة المتجددة']],
    ['supNoha', 'د. نهى عبد الرحمن', 'noha.abdelrahman@mnu.edu.eg', 'eng', 'bme', true, ['الهندسة الطبية الحيوية', 'معالجة الإشارات الحيوية', 'الأجهزة الطبية']],
    ['supAmr', 'د. عمرو الدسوقي', 'amr.eldessouky@mnu.edu.eg', 'eng', 'sar', false, ['العمارة المستدامة', 'التصميم البيئي', 'BIM']],
    ['supWalid', 'د. وليد زكي', 'walid.zaki@mnu.edu.eg', 'bus', 'een', true, ['ريادة الأعمال', 'التقنية المالية', 'تحليل الأعمال']],
    ['supMona', 'د. منى الجمل', 'mona.elgamal@mnu.edu.eg', 'bus', 'dmo', false, ['التسويق الرقمي', 'التجارة الإلكترونية', 'تحليل البيانات']],
    ['supYasser', 'د. ياسر الفقي', 'yasser.elfeky@mnu.edu.eg', 'phm', 'cph', true, ['الصيدلة الإكلينيكية', 'المعلوماتية الدوائية']],
    ['supSalwa', 'د. سلوى الشناوي', 'salwa.elshenawy@mnu.edu.eg', 'med', 'mbbs', true, ['الطب الباطني', 'المعلوماتية الطبية', 'الصحة الرقمية']],
    ['supEman', 'د. إيمان المتولي', 'eman.elmetwally@mnu.edu.eg', 'nur', 'ccn', true, ['تمريض العناية الحرجة', 'نظم مراقبة المرضى']],
  ];

  for (const [key, name, email, cKey, dKey, isDeptAdmin, skills] of supervisorSpecs) {
    const col = colleges[cKey];
    const dept = departments[dKey];
    const roles = [
      {
        role: ROLES.SUPERVISOR,
        scopeType: SCOPE_TYPES.DEPARTMENT,
        scopeId: dept._id,
        collegeId: col._id,
        departmentId: dept._id,
      },
      {
        role: ROLES.COMMITTEE_MEMBER,
        scopeType: SCOPE_TYPES.COLLEGE,
        scopeId: col._id,
        collegeId: col._id,
      },
    ];
    if (isDeptAdmin) {
      roles.push({
        role: ROLES.DEPARTMENT_ADMIN,
        scopeType: SCOPE_TYPES.DEPARTMENT,
        scopeId: dept._id,
        collegeId: col._id,
        departmentId: dept._id,
      });
    }
    await createUser(key, {
      name,
      email,
      accountType: ACCOUNT_TYPES.STAFF,
      collegeId: col._id,
      departmentId: dept._id,
      profile: {
        bio: `عضو هيئة تدريس بقسم ${dept.name} — ${col.name}، جامعة المنصورة الأهلية.`,
        skills,
      },
      roles,
    }, 100);
  }

  // 4. External Examiners (Committee Members)
  await createUser('extAbulnaga', {
    name: 'أ.د. محمود أبو النجا',
    email: 'm.abulnaga@mans.edu.eg',
    accountType: ACCOUNT_TYPES.STAFF,
    collegeId: colleges.eng._id,
    profile: {
      bio: 'أستاذ هندسة الحاسبات بجامعة المنصورة وممتحن خارجي لمشاريع التخرج.',
      skills: ['تحكيم المشاريع', 'الأنظمة الذكية', 'هندسة البرمجيات'],
    },
    roles: [
      { role: ROLES.COMMITTEE_MEMBER, scopeType: SCOPE_TYPES.UNIVERSITY },
    ],
  }, 90);

  await createUser('extSameh', {
    name: 'م. سامح قنديل',
    email: 'sameh.kandil@valeotech.eg',
    accountType: ACCOUNT_TYPES.STAFF,
    collegeId: colleges.eng._id,
    profile: {
      bio: 'مدير هندسة البرمجيات المدمجة — شريك صناعي وممتحن خارجي.',
      skills: ['الأنظمة المدمجة', 'الروبوتات الصناعية', 'الذكاء الاصطناعي التطبيقي'],
    },
    roles: [
      { role: ROLES.COMMITTEE_MEMBER, scopeType: SCOPE_TYPES.UNIVERSITY },
    ],
  }, 85);

  // 5. Students (36 students — 28 current cohort 2026/2027 + 8 alumni/senior cohort 2025/2026)
  const studentSpecs = [
    // Team 1: Retina AI (ENG/AIE + MED partner)
    ['stSara', 'سارة علي حسن', 'sara@mnu.edu.eg', '20260001', 'eng', 'aie', ['Python', 'PyTorch', 'Computer Vision', 'React'], true],
    ['stYoussef', 'يوسف أحمد عبد الله', 'youssef.ahmed@mnu.edu.eg', '20260002', 'eng', 'aie', ['FastAPI', 'Docker', 'Deep Learning'], true],
    ['stMariam', 'مريم محمود الشافعي', 'mariam.elshafei@mnu.edu.eg', '20260003', 'eng', 'aie', ['React', 'UI/UX', 'TypeScript'], false],
    ['stOmarMed', 'عمر خالد عبد المنعم', 'omar.khaled@mnu.edu.eg', '20260004', 'med', 'mbbs', ['التصوير الطبي', 'البيانات السريرية'], true],

    // Team 2: Rehab Robotic Arm (ENG/BME)
    ['stNourhan', 'نورهان طارق الغمري', 'nourhan.tarek@mnu.edu.eg', '20260010', 'eng', 'bme', ['Embedded C', 'EMG Signals', 'STM32'], true],
    ['stZiad', 'زياد محمد المتولي', 'ziad.elmetwally@mnu.edu.eg', '20260011', 'eng', 'bme', ['SolidWorks', 'ROS2', '3D Printing'], false],
    ['stHabiba', 'حبيبة أيمن سعد', 'habiba.ayman@mnu.edu.eg', '20260012', 'eng', 'bme', ['MATLAB', 'Control Systems'], true],

    // Team 3: MNU Smart Solar Grid (ENG/MCT)
    ['stMazen', 'مازن وليد العيسوي', 'mazen.eleissawy@mnu.edu.eg', '20260020', 'eng', 'mct', ['IoT', 'PLC', 'ESP32', 'Solar PV'], true],
    ['stAhmedS', 'أحمد سامي البدوي', 'ahmed.sami@mnu.edu.eg', '20260021', 'eng', 'mct', ['Node.js', 'MQTT', 'SCADA'], true],
    ['stRana', 'رنا حسام عبد القادر', 'rana.hossam@mnu.edu.eg', '20260022', 'eng', 'mct', ['Power Electronics', 'MATLAB/Simulink'], false],

    // Team 4: MNU FinHub (BUS/EEN)
    ['stKareemB', 'كريم أشرف الدالي', 'kareem.eldaly@mnu.edu.eg', '20260030', 'bus', 'een', ['التقنية المالية', 'تحليل الأعمال', 'Product Management'], true],
    ['stSalmaB', 'سلمى هشام نصر', 'salma.hesham@mnu.edu.eg', '20260031', 'bus', 'een', ['التخطيط المالي', 'Power BI', 'UX Research'], true],
    ['stTarekB', 'طارق إبراهيم الجندي', 'tarek.elgendy@mnu.edu.eg', '20260032', 'bus', 'een', ['React', 'Node.js', 'Payment APIs'], false],

    // Team 5: Clinical Pharmacist AI Assistant (PHM/CPH)
    ['stNadaP', 'ندى علاء الدين فؤاد', 'nada.alaa@mnu.edu.eg', '20260040', 'phm', 'cph', ['الصيدلة الإكلينيكية', 'Drug Interactions', 'Python'], true],
    ['stMostafaP', 'مصطفى جمال زيدان', 'mostafa.gamal@mnu.edu.eg', '20260041', 'phm', 'cph', ['Pharmacokinetics', 'Clinical Data'], false],
    ['stYaraP', 'يارا شريف العطار', 'yara.sherif@mnu.edu.eg', '20260042', 'eng', 'aie', ['NLP', 'RAG', 'FastAPI'], true],

    // Team 6: Autonomous Agri-Drone Dakahlia (ENG/CCE)
    ['stAbdelrahman', 'عبد الرحمن ناصر جودة', 'abdelrahman.nasser@mnu.edu.eg', '20260050', 'eng', 'cce', ['Pixhawk', 'Computer Vision', 'C++'], true],
    ['stSeif', 'سيف الدين عماد راشد', 'seif.emad@mnu.edu.eg', '20260051', 'eng', 'cce', ['Raspberry Pi', 'LoRaWAN', 'Python'], false],
    ['stMalak', 'ملك وائل الصاوي', 'malak.wael@mnu.edu.eg', '20260052', 'eng', 'cce', ['GIS', 'Remote Sensing', 'Flutter'], true],

    // Team 7: Zero-Emission Campus Hub (ENG/SAR)
    ['stFarah', 'فرح حاتم النجار', 'farah.hatem@mnu.edu.eg', '20260060', 'eng', 'sar', ['Revit', 'BIM', 'EnergyPlus', 'Sustainable Design'], true],
    ['stAdham', 'أدهم محمد الشهاوي', 'adham.elshahawy@mnu.edu.eg', '20260061', 'eng', 'sar', ['Rhino 3D', 'Grasshopper', 'Lumion'], false],

    // Team 8: ICU Early Warning Platform (NUR/CCN)
    ['stEsraaN', 'إسراء محمود حماد', 'esraa.hammad@mnu.edu.eg', '20260070', 'nur', 'ccn', ['العناية الحرجة', 'مؤشرات الإنذار المبكر', 'جودة الرعاية'], true],
    ['stHagerN', 'هاجر سعيد البنا', 'hager.saeed@mnu.edu.eg', '20260071', 'nur', 'ccn', ['التمريض السريري', 'التوعية الصحية'], false],

    // Team 9: Delta SMEs E-Commerce Analytics (BUS/DMO) — supervisor_recommended
    ['stBassel', 'باسل تامر سليم', 'bassel.tamer@mnu.edu.eg', '20260080', 'bus', 'dmo', ['التسويق الرقمي', 'Google Analytics', 'SEO'], true],
    ['stNermine', 'نرمين مجدي عفيفي', 'nermine.magdy@mnu.edu.eg', '20260081', 'bus', 'dmo', ['تحليل البيانات', 'SQL', 'Tableau'], false],

    // Team 10: Hospital Cyber Defense (ENG/CCE) — under_review
    ['stMoaz', 'معاذ مصطفى السعدني', 'moaz.elsaadany@mnu.edu.eg', '20260090', 'eng', 'cce', ['الأمن السيبراني', 'SIEM', 'Network Security'], true],
    ['stAyman', 'أيمن صبري حسنين', 'ayman.sabry@mnu.edu.eg', '20260091', 'eng', 'cce', ['Penetration Testing', 'Linux', 'Docker'], false],

    // Team 11: Chronic Disease Student App (MED/MBBS) — needs_changes
    ['stHanaM', 'هنا ياسر عبد الحميد', 'hana.yasser@mnu.edu.eg', '20260100', 'med', 'mbbs', ['الصحة العامة', 'التثقيف الطبي'], false],
    ['stAliM', 'علي هاني الشناوي', 'ali.hany@mnu.edu.eg', '20260101', 'med', 'mbbs', ['البيانات الوبائية', 'تطبيقات الصحة'], false],

    // Team 12: Startup Financial Analyzer (BUS/ECF) — submitted
    ['stLailaF', 'ليلى خالد منصور', 'laila.mansour@mnu.edu.eg', '20260110', 'bus', 'ecf', ['التحليل المالي', 'النمذجة الاقتصادية', 'Python'], false],
    ['stRamyF', 'رامي نبيل عزت', 'ramy.nabil@mnu.edu.eg', '20260111', 'bus', 'ecf', ['المحاسبة المالية', 'Power BI'], false],

    // Team 13: Smart Formulation Lab (PHM/PHT) — draft
    ['stDaliaP', 'داليا أحمد شوقي', 'dalia.shawky@mnu.edu.eg', '20260120', 'phm', 'pht', ['التكنولوجيا الصيدلية', 'ضبط الجودة'], false],

    // Free / Unassigned students (great for testing team invitations during live demo!)
    ['stFreeEng1', 'شادي عماد فرحات', 'shady.emad@mnu.edu.eg', '20260190', 'eng', 'cce', ['Cybersecurity', 'Python', 'React'], false],
    ['stFreeEng2', 'آية حسني السعيد', 'aya.hosny@mnu.edu.eg', '20260191', 'eng', 'aie', ['Machine Learning', 'Data Science'], false],
    ['stFreeBus1', 'مروان عادل بركات', 'marwan.adel@mnu.edu.eg', '20260192', 'bus', 'een', ['التسويق', 'إدارة المشاريع'], false],

    // 2025/2026 Graduated/Previous-Year Cohort Students (8 students across 4 archived projects)
    ['stPrev1', 'أحمد علاء الشرقاوي', 'ahmed.elsharkawy@mnu.edu.eg', '20250001', 'phm', 'pht', ['التكنولوجيا الصيدلية', 'الاستدامة البيئية'], true],
    ['stPrev2', 'نورسين حسام الكومي', 'noursin.elkomy@mnu.edu.eg', '20250002', 'phm', 'pht', ['إدارة النفايات الطبية', 'IoT'], true],
    ['stPrev3', 'خالد محمد ربيع', 'khaled.rabie@mnu.edu.eg', '20250010', 'eng', 'mct', ['الروبوتات', 'Ultrasonic Sensors', 'ROS'], true],
    ['stPrev4', 'محمود طارق أبو زيد', 'mahmoud.abuzeid@mnu.edu.eg', '20250011', 'eng', 'mct', ['Embedded Systems', 'PCB Design'], true],
    ['stPrev5', 'منة الله سعيد درويش', 'menna.darwish@mnu.edu.eg', '20250020', 'med', 'mbbs', ['السكري والغدد الصماء', 'نظم دعم القرار'], true],
    ['stPrev6', 'إسلام فتحي الجزار', 'islam.elgazzar@mnu.edu.eg', '20250021', 'med', 'mbbs', ['الذكاء الاصطناعي الطبي', 'الإحصاء الحيوي'], false],
    ['stPrev7', 'ياسمين وائل بدر', 'yasmin.badr@mnu.edu.eg', '20250030', 'bus', 'een', ['التمويل الجماعي', 'ريادة الأعمال الاجتماعية'], true],
    ['stPrev8', 'عمرو هشام الصياد', 'amr.elsayyad@mnu.edu.eg', '20250031', 'bus', 'een', ['التسويق الرقمي', 'تطوير الأعمال'], false],
  ];

  for (const [key, name, email, studentId, cKey, dKey, skills, publicContacts] of studentSpecs) {
    const col = colleges[cKey];
    const dept = departments[dKey];
    await createUser(key, {
      name,
      email,
      studentId,
      accountType: ACCOUNT_TYPES.STUDENT,
      collegeId: col._id,
      departmentId: dept._id,
      profile: {
        bio: `طالب بقسم ${dept.name} — ${col.name}، جامعة المنصورة الأهلية.`,
        skills,
        phone: `+2010${studentId}`,
        socialLinks: [`https://github.com/${email.split('@')[0].replace('.', '-')}`],
      },
      privacy: {
        email: publicContacts ? PRIVACY_VISIBILITY.PUBLIC : PRIVACY_VISIBILITY.PRIVATE,
        phone: publicContacts ? PRIVACY_VISIBILITY.PUBLIC : PRIVACY_VISIBILITY.PRIVATE,
        socialLinks: PRIVACY_VISIBILITY.PUBLIC,
      },
      roles: [
        {
          role: ROLES.STUDENT,
          scopeType: SCOPE_TYPES.DEPARTMENT,
          scopeId: dept._id,
          collegeId: col._id,
          departmentId: dept._id,
        },
      ],
    }, 80);
  }

  // 6. Investors (3 ACTIVE + 1 PENDING for admin review queue!)
  await createUser('invDelta', {
    name: 'م. عمر الجارحي — دلتا فنتشرز',
    email: 'investor@deltaventures.eg',
    accountType: ACCOUNT_TYPES.INVESTOR,
    profile: {
      bio: 'صندوق استثماري ومسرّعة أعمال تدعم الشركات الناشئة التكنولوجية في منطقة الدلتا.',
      skills: ['الاستثمار الجريء', 'احتضان المشاريع', 'تطوير المنتجات'],
      phone: '+201223344556',
    },
    investor: {
      organization: 'دلتا فنتشرز للاستثمار التكنولوجي',
      fieldOfInterest: 'الذكاء الاصطناعي والتقنية المالية',
      reviewedBy: users.uniAdmin._id,
      reviewedAt: daysAgo(55),
    },
    roles: [{ role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF }],
  }, 60);

  await createUser('invNileMed', {
    name: 'د. رانيا الشاذلي — النيل للتقنيات الطبية',
    email: 'rania@nilemedtech.eg',
    accountType: ACCOUNT_TYPES.INVESTOR,
    profile: {
      bio: 'شركة رائدة في تطوير الحلول الطبية الذكية وأجهزة إعادة التأهيل في مصر.',
      skills: ['الأجهزة الطبية', 'الصحة الرقمية', 'الشراكات البحثية'],
      phone: '+201112233445',
    },
    investor: {
      organization: 'النيل للتقنيات الطبية (Nile MedTech)',
      fieldOfInterest: 'الهندسة الطبية والذكاء الاصطناعي الصحي',
      reviewedBy: users.uniAdmin._id,
      reviewedAt: daysAgo(48),
    },
    roles: [{ role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF }],
  }, 52);

  await createUser('invEgySolar', {
    name: 'م. أحمد الوكيل — إيجي سولار للطاقة',
    email: 'ahmed@egysolar.com',
    accountType: ACCOUNT_TYPES.INVESTOR,
    profile: {
      bio: 'شريك صناعي في مجال الشبكات الذكية والطاقة المتجددة والتحول الأخضر.',
      skills: ['الطاقة الشمسية', 'الشبكات الذكية', 'إنترنت الأشياء الصناعي'],
      phone: '+201098877665',
    },
    investor: {
      organization: 'إيجي سولار للحلول الذكية',
      fieldOfInterest: 'الطاقة المتجددة والزراعة الذكية',
      reviewedBy: users.uniAdmin._id,
      reviewedAt: daysAgo(40),
    },
    roles: [{ role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF }],
  }, 45);

  await createUser('invPending', {
    name: 'شركة المستقبل للاستثمار التكنولوجي',
    email: 'investor@future.com',
    status: USER_STATUSES.PENDING,
    accountType: ACCOUNT_TYPES.INVESTOR,
    profile: {
      bio: 'شركة استثمارية مهتمة برعاية مشاريع التخرج في مجال الروبوتات والأمن السيبراني.',
    },
    investor: {
      organization: 'المستقبل للاستثمار والتطوير الصناعي',
      fieldOfInterest: 'الأنظمة الذكية والروبوتات',
    },
    roles: [{ role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF }],
  }, 3);

  // 7. Visitors (4 active community visitors who vote & comment)
  const visitorSpecs = [
    ['visNada', 'ندى محمود العجمي', 'nada.visitor@gmail.com'],
    ['visHazem', 'حازم سمير الطوخي', 'hazem.visitor@gmail.com'],
    ['visDina', 'دينا عادل منصور', 'dina.visitor@gmail.com'],
    ['visKarim', 'كريم فوزي البلتاجي', 'karim.visitor@gmail.com'],
  ];
  for (const [key, name, email] of visitorSpecs) {
    await createUser(key, {
      name,
      email,
      accountType: ACCOUNT_TYPES.VISITOR,
      profile: { bio: 'زائر مهتم بابتكارات طلاب جامعة المنصورة الأهلية.' },
      roles: [{ role: ROLES.VISITOR, scopeType: SCOPE_TYPES.SELF }],
    }, 30);
  }

  // 8. Invitations (active + used)
  await Invitation.create([
    {
      kind: INVITATION_KINDS.ROLE,
      tokenHash: sha256('mnu-demo-invite-supervisor-ai-2026'),
      role: ROLES.SUPERVISOR,
      scopeType: SCOPE_TYPES.DEPARTMENT,
      scopeId: departments.aie._id,
      collegeId: colleges.eng._id,
      departmentId: departments.aie._id,
      inviteeName: 'د. حسام الدين عبد الله',
      createdBy: users.engAdmin._id,
      expiresAt: daysFromNow(14),
    },
    {
      kind: INVITATION_KINDS.EXTERNAL_EXAMINER,
      tokenHash: sha256('mnu-demo-invite-ext-examiner-used'),
      role: ROLES.COMMITTEE_MEMBER,
      scopeType: SCOPE_TYPES.UNIVERSITY,
      inviteeName: 'أ.د. محمود أبو النجا',
      createdBy: users.engAdmin._id,
      expiresAt: daysFromNow(30),
      usedAt: daysAgo(20),
      usedBy: users.extAbulnaga._id,
    },
  ]);

  return {
    university,
    colleges,
    departments,
    years,
    templates,
    rubrics,
    users,
  };
}

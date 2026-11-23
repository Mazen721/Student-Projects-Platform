import {
  ADOPTION_REQUEST_STATUSES,
  BOM_STATUSES,
  DEFENSE_STATES,
  DELIVERABLE_STATUSES,
  IDEA_STATUSES,
  LINK_KINDS,
  PROJECT_TYPES,
  PROPOSAL_STATUSES,
  STATUS_FLAGS,
  SUBMISSION_DECISIONS,
  SUPERVISION_KINDS,
  TASK_COLUMNS,
  TEAM_INVITATION_STATUSES,
  TEAM_MEMBER_ROLES,
  TOOL_CATEGORIES,
  TRANSFER_STATUSES,
} from '@spp/shared/constants';
import { computeProgress } from '@spp/shared/calc';
import AdoptionRequest from '../../modules/projects/adoptionRequest.model.js';
import Idea from '../../modules/projects/idea.model.js';
import LeadershipTransfer from '../../modules/projects/leadershipTransfer.model.js';
import Project from '../../modules/projects/project.model.js';
import ProjectMembership from '../../modules/projects/projectMembership.model.js';
import ProposalVersion from '../../modules/projects/proposalVersion.model.js';
import SupervisorAssignment from '../../modules/projects/supervisorAssignment.model.js';
import TeamInvitation from '../../modules/projects/teamInvitation.model.js';
import BOMItem from '../../modules/tracking/bomItem.model.js';
import Deliverable from '../../modules/tracking/deliverable.model.js';
import Meeting from '../../modules/tracking/meeting.model.js';
import ProjectPhase from '../../modules/tracking/projectPhase.model.js';
import Submission from '../../modules/tracking/submission.model.js';
import Task from '../../modules/tracking/task.model.js';
import TimelineEvent from '../../modules/tracking/timelineEvent.model.js';
import ToolItem from '../../modules/tracking/toolItem.model.js';
import {
  SEED_IMAGES,
  backdateCreatedAt,
  daysAgo,
  daysFromNow,
  makeDocRef,
  makeImageRef,
  sha256,
} from './helpers.js';

function buildSnapshot(p) {
  return {
    title: p.title,
    idea: p.idea,
    problem: p.problem,
    objectives: [...p.objectives],
    scope: p.scope,
    field: p.field,
    type: p.type,
    beneficiaries: p.beneficiaries,
    keywords: [...p.keywords],
    expectedOutcomes: p.expectedOutcomes,
    cover: p.cover || null,
    preferredSupervisorId: p.preferredSupervisorId || null,
    ideaId: p.ideaId || null,
  };
}

export async function seedProjectsAndTracking(ctx) {
  const { colleges, departments, years, templates, users } = ctx;

  // 1. Seed Idea Bank (8 authentic MNU ideas)
  const ideas = {};
  const ideaSpecs = [
    [
      'ideaRetina',
      'التشخيص الآلي لاعتلال الشبكية السكري بالذكاء الاصطناعي',
      'تطوير نموذج رؤية حاسوبية دقيق لتحليل صور قاع العين واكتشاف اعتلال الشبكية السكري في مراحله المبكرة لدعم أطباء العيون بالمستشفيات الجامعية بالمنصورة.',
      'ai',
      PROJECT_TYPES.SOFTWARE,
      users.supTarek._id,
      'supervisor',
      colleges.eng._id,
      IDEA_STATUSES.TAKEN,
    ],
    [
      'ideaSolar',
      'منصة إدارة وتحسين كفاءة الألواح الشمسية بالمباني الجامعية الذكية',
      'تصميم نظام متكامل يعتمد على إنترنت الأشياء للتنبؤ بالإنتاج الشمسي واكتشاف أعطال الألواح وتوزيع الأحمال داخل حرم جامعة المنصورة الأهلية.',
      'renewable_energy',
      PROJECT_TYPES.HYBRID,
      users.invEgySolar._id,
      'investor',
      colleges.eng._id,
      IDEA_STATUSES.TAKEN,
    ],
    [
      'ideaSmartCampus',
      'مساعد صوتي ذكي لإرشاد الطلاب الجدد داخل حرم جامعة المنصورة الأهلية',
      'بناء تطبيق تفاعلي مدعوم بنماذج اللغة العربية للإجابة عن استفسارات الساعات المعتمدة، جداول القاعات، والخدمات الطلابية بالجامعة.',
      'ai',
      PROJECT_TYPES.SOFTWARE,
      users.supTarek._id,
      'supervisor',
      colleges.eng._id,
      IDEA_STATUSES.OPEN,
    ],
    [
      'ideaDrugTrack',
      'نظام تتبع سلسلة التبريد للأدوية واللقاحات باستخدام مستشعرات IoT وBlockchain',
      'مراقبة درجات حرارة تخزين ونقل المستحضرات الحيوية واللقاحات لحظياً مع سجل غير قابل للتعديل لضمان الجودة الدوائية.',
      'iot_embedded',
      PROJECT_TYPES.HYBRID,
      users.supYasser._id,
      'supervisor',
      colleges.phm._id,
      IDEA_STATUSES.OPEN,
    ],
    [
      'ideaWearableEcg',
      'جهاز تخطيط قلب محمول منخفض التكلفة للإنذار المبكر لمرضى القلب عن بُعد',
      'تطوير وحدة قياس ECG لاسلكية متصلة بتطبيق هاتف يرسل تنبيهات فورية للطبيب المعالج عند رصد اضطرابات النظم القلبي.',
      'biomedical',
      PROJECT_TYPES.HARDWARE,
      users.invNileMed._id,
      'investor',
      colleges.eng._id,
      IDEA_STATUSES.OPEN,
    ],
    [
      'ideaExportB2b',
      'منصة رقمية لربط المصانع الصغيرة بدمياط والدقهلية بأسواق التصدير الإقليمية',
      'تحليل الطلب الخارجي وتبسيط إجراءات التسعير والتسويق الرقمي لمنتجات الأثاث والصناعات الغذائية بمنطقة الدلتا.',
      'business_fintech',
      PROJECT_TYPES.SOFTWARE,
      users.supWalid._id,
      'supervisor',
      colleges.bus._id,
      IDEA_STATUSES.OPEN,
    ],
    [
      'ideaDeltaAgri',
      'نظام تنبؤ بآفات المحاصيل الاستراتيجية بالدلتا عبر صور الأقمار الصناعية',
      'توظيف بيانات الاستشعار عن بُعد وخوارزميات التعلم الآلي لتنبيه المزارعين والجمعيات الزراعية مبكراً قبل انتشار الآفات.',
      'data_science',
      PROJECT_TYPES.RESEARCH,
      users.invDelta._id,
      'investor',
      null,
      IDEA_STATUSES.OPEN,
    ],
    [
      'ideaTriage',
      'نظام فرز إلكتروني ذكي لحالات الطوارئ في المستشفيات التعليمية',
      'مساعدة فرق التمريض على تقييم أولوية الحالات الحرجة وتقليل أزمنة الانتظار وفق بروتوكولات الفرز العالمية.',
      'biomedical',
      PROJECT_TYPES.SOFTWARE,
      users.supEman._id,
      'supervisor',
      colleges.nur._id,
      IDEA_STATUSES.OPEN,
    ],
  ];

  for (const [key, title, description, field, type, ownerId, ownerKind, collegeId, status] of ideaSpecs) {
    ideas[key] = await Idea.create({
      title,
      description,
      field,
      type,
      ownerId,
      ownerKind,
      collegeId,
      status,
    });
  }

  // 2. Define 16 Projects (12 current 2026/2027 + 4 archived 2025/2026)
  const projects = {};
  const trackingMap = {}; // projectKey -> { phases, deliverables, submissions, tasks, meetings }

  const projectDefs = [
    // ---------- CURRENT YEAR 2026/2027 ----------
    {
      key: 'retinaAi',
      yearSlot: 'curr',
      cKey: 'eng',
      dKey: 'aie',
      partnerCKeys: ['med'],
      partnerDKeys: ['mbbs'],
      slug: 'mnu-retina-ai-diagnosis',
      title: 'منصة التشخيص المبكر لأمراض شبكية العين بالذكاء الاصطناعي',
      idea: 'منصة سحابية مدعومة بالتعلم العميق لتحليل صور قاع العين وتصنيف درجات اعتلال الشبكية السكري خلال ثوانٍ بدقة سريرية عالية.',
      problem: 'يعاني ملايين مرضى السكري في مصر والدلتا من تأخر اكتشاف اعتلال الشبكية بسبب قلة أخصائيي العيون وارتفاع تكلفة الفحص الدوري.',
      objectives: [
        'تدريب نموذج رؤية حاسوبية هجين (ConvNeXt + Vision Transformer) بدقة تتجاوز 94%.',
        'توفير خرائط حرارية تفسيرية (Grad-CAM) تساعد الطبيب على التحقق من مناطق الإصابة.',
        'بناء بوابة ويب عربية متكاملة لعيادات مستشفى المنصورة الجامعي والأهلي.',
      ],
      scope: 'تحليل صور Fundus وتصنيفها إلى 5 درجات سريرية مع توليد تقارير طبية قابلة للتصدير بصيغة PDF.',
      field: 'ai',
      type: PROJECT_TYPES.SOFTWARE,
      beneficiaries: 'أطباء الرمد، مرضى السكري، والمستشفيات التعليمية بمحافظة الدقهلية.',
      keywords: ['الذكاء الاصطناعي', 'شبكية العين', 'الرؤية الحاسوبية', 'الصحة الرقمية', 'PyTorch'],
      expectedOutcomes: 'نظام تشخيص مساعد يختصر وقت الفحص بنسبة 70% ويسهل الفرز المبكر في القوافل الطبية.',
      cover: makeImageRef('cover-retina', SEED_IMAGES.retinaAi, 'retina-cover.jpg'),
      status: PROPOSAL_STATUSES.APPROVED,
      statusFlag: STATUS_FLAGS.ON_TRACK,
      defenseState: DEFENSE_STATES.FINALIZED,
      leader: 'stSara',
      members: ['stSara', 'stYoussef', 'stMariam', 'stOmarMed'],
      primarySup: 'supTarek',
      coSups: ['supSalwa'],
      mentors: ['invNileMed'],
      ideaKey: 'ideaRetina',
      phaseMode: 'all_approved',
      isPublished: true,
      bom: [
        ['خادم معالجة رسومية (GPU Cloud Credits — 6 أشهر)', 1, 'NVIDIA A10G لتدريب نماذج الرؤية الحاسوبية', 9500, 'AWS / RunPod', BOM_STATUSES.RECEIVED],
        ['عدسة تصوير قاع عين محمولة للهاتف (Fundus Lens)', 2, 'دقة بصرية 20D متوافقة مع الهواتف الذكية', 3200, 'ميديكال تك المنصورة', BOM_STATUSES.RECEIVED],
        ['جهاز لوحي للعرض السريري والاختبار الميداني', 1, 'شاشة 11 بوصة عالية الدقة', 2600, 'دلتا إلكترونيكس', BOM_STATUSES.RECEIVED],
      ],
      tools: [
        [TOOL_CATEGORIES.LANGUAGE, 'Python', '3.12', 'تدريب النماذج وخدمات الخلفية'],
        [TOOL_CATEGORIES.FRAMEWORK, 'PyTorch', '2.5', 'بناء وتدريب شبكات ConvNeXt وViT'],
        [TOOL_CATEGORIES.FRAMEWORK, 'FastAPI', '0.115', 'واجهة برمجة الاستدلال الفوري'],
        [TOOL_CATEGORIES.FRAMEWORK, 'React', '19', 'لوحة الأطباء والتقارير التفسيرية'],
        [TOOL_CATEGORIES.SERVICE, 'MongoDB Atlas', '7.0', 'حفظ ملفات الحالات وسجل الفحوصات'],
      ],
    },
    {
      key: 'robotArm',
      yearSlot: 'curr',
      cKey: 'eng',
      dKey: 'bme',
      slug: 'mnu-rehab-robotic-arm',
      title: 'ذراع روبوتية ذكية لإعادة تأهيل مرضى السكتة الدماغية',
      idea: 'ذراع هيكلية خارجية خفيفة الوزن تقرأ الإشارات العضلية (EMG) وتساعد مرضى السكتة الدماغية على استعادة الحركة عبر جلسات علاج طبيعي ذكية.',
      problem: 'ارتفاع تكلفة أجهزة التأهيل الروبوتية المستوردة وصعوبة متابعة تقدم المريض رقمياً داخل مراكز العلاج الطبيعي.',
      objectives: [
        'تصميم هيكل ميكانيكي مطبوع ثلاثي الأبعاد بوزن أقل من 1.4 كجم.',
        'قراءة وتصفية إشارات العضلات السطحية (sEMG) في الزمن الحقيقي باستخدام STM32.',
        'تطوير تطبيق متابعة يعرض زوايا الحركة ومؤشرات التحسن لأخصائي العلاج الطبيعي.',
      ],
      scope: 'نموذج أولي للطرف العلوي (مفصل الكوع والرسغ) مع نظام أمان ميكانيكي وبرمجي وتطبيق متابعة.',
      field: 'biomedical',
      type: PROJECT_TYPES.HYBRID,
      beneficiaries: 'مرضى السكتة الدماغية ومراكز التأهيل والعلاج الطبيعي.',
      keywords: ['الهندسة الطبية', 'الروبوتات', 'EMG', 'إعادة التأهيل', 'STM32'],
      expectedOutcomes: 'نموذج عملي بتكلفة أقل بنسبة 80% من البدائل المستوردة مع تقارير تقدم كمية.',
      cover: makeImageRef('cover-robot-arm', SEED_IMAGES.robotArm, 'robot-arm.jpg'),
      status: PROPOSAL_STATUSES.APPROVED,
      statusFlag: STATUS_FLAGS.ON_TRACK,
      defenseState: DEFENSE_STATES.GRADING,
      leader: 'stNourhan',
      members: ['stNourhan', 'stZiad', 'stHabiba'],
      primarySup: 'supNoha',
      coSups: ['supKarim'],
      mentors: [],
      phaseMode: 'all_approved',
      isPublished: true,
      bom: [
        ['متحكم STM32F407 Discovery Board', 2, 'معالج ARM Cortex-M4 لمعالجة الإشارات', 1450, 'RAM Electronics', BOM_STATUSES.RECEIVED],
        ['حساسات إشارات عضلية MyoWare 2.0 EMG', 3, 'أقطاب قياس سطحية عالية الحساسية', 2800, 'Future Electronics EG', BOM_STATUSES.RECEIVED],
        ['محركات سيرفو عالية العزم 35kg.cm', 4, 'تروس معدنية مع حساس زاوية مدمج', 1900, 'Robokits Cairo', BOM_STATUSES.RECEIVED],
        ['خامات طباعة ثلاثية الأبعاد (Carbon-PLA)', 4, 'بكرة 1 كجم لتصنيع الهيكل الخارجي', 1350, '3D Egypt', BOM_STATUSES.RECEIVED],
      ],
      tools: [
        [TOOL_CATEGORIES.LANGUAGE, 'C++', '20', 'برمجة المتحكمات وخوارزميات التحكم PID'],
        [TOOL_CATEGORIES.FRAMEWORK, 'ROS2', 'Humble', 'محاكاة الحركة والتكامل الروبوتي'],
        [TOOL_CATEGORIES.LIBRARY, 'MATLAB', 'R2025b', 'تحليل إشارات EMG وتصميم المرشحات'],
        [TOOL_CATEGORIES.OTHER, 'SolidWorks', '2025', 'التصميم الميكانيكي وتحليل الإجهادات'],
      ],
    },
    {
      key: 'solarGrid',
      yearSlot: 'curr',
      cKey: 'eng',
      dKey: 'mct',
      slug: 'mnu-smart-solar-microgrid',
      title: 'نظام إدارة الشبكات الشمسية الذكية لحرم جامعة المنصورة الأهلية',
      idea: 'منظومة هجينة لإدارة الطاقة الشمسية والتخزين الذكي لمباني جامعة المنصورة الأهلية مع لوحة SCADA للتنبؤ بالأحمال وتقليل الفاقد.',
      problem: 'تذبذب إنتاج الطاقة الشمسية وارتفاع أحمال التبريد في مباني الحرم الجامعي بالمنصورة الجديدة خلال ساعات الذروة.',
      objectives: [
        'تصميم وحدة مراقبة ذكية لكل مصفوفة شمسية باستخدام ESP32 وبروتوكول MQTT.',
        'التنبؤ بإنتاج الطاقة خلال 24 ساعة باستخدام بيانات الطقس وتعلم الآلة.',
        'تفعيل فصل وتحويل تلقائي للأحمال غير الحرجة لخفض استهلاك الشبكة بنسبة 25%.',
      ],
      scope: 'نموذج معملي مصغّر لشبكة ميكروية (Microgrid) متصلة بمنصة مراقبة وتحكم سحابية.',
      field: 'renewable_energy',
      type: PROJECT_TYPES.HYBRID,
      beneficiaries: 'إدارة المنشآت والطاقة بجامعة المنصورة الأهلية والمدن الذكية الجديدة.',
      keywords: ['الطاقة المتجددة', 'الشبكات الذكية', 'IoT', 'SCADA', 'الاستدامة'],
      expectedOutcomes: 'خفض الفاتورة الكهربائية وتقليل الانبعاثات الكربونية بالحرم الجامعي.',
      cover: makeImageRef('cover-solar', SEED_IMAGES.solarGrid, 'solar-grid.jpg'),
      status: PROPOSAL_STATUSES.APPROVED,
      statusFlag: STATUS_FLAGS.ON_TRACK,
      defenseState: DEFENSE_STATES.SCHEDULED,
      leader: 'stMazen',
      members: ['stMazen', 'stAhmedS', 'stRana'],
      primarySup: 'supKarim',
      coSups: ['supHeba'],
      mentors: ['invEgySolar'],
      ideaKey: 'ideaSolar',
      phaseMode: 'all_approved',
      isPublished: true,
      bom: [
        ['ألواح شمسية أحادية البلورة 150W', 4, 'كفاءة تحويل 21.5% للاختبار المعملي', 2900, 'إيجي سولار', BOM_STATUSES.RECEIVED],
        ['عاكس هجين مع منظم شحن MPPT', 1, 'قدرة 1.5 كيلووات مع منفذ RS485', 8600, 'سولار دلتا', BOM_STATUSES.RECEIVED],
        ['بطاريات LiFePO4 للتخزين الذكي', 2, 'سعة 12V 50Ah مع نظام BMS', 4500, 'باور تك مصر', BOM_STATUSES.RECEIVED],
        ['وحدات ESP32 وحساسات تيار وجهد INA226', 6, 'قياس دقيق للقدرة الكهربائية', 370, 'RAM Electronics', BOM_STATUSES.RECEIVED],
      ],
      tools: [
        [TOOL_CATEGORIES.FRAMEWORK, 'Node.js', '22', 'خادم استقبال بيانات المستشعرات وMQTT'],
        [TOOL_CATEGORIES.FRAMEWORK, 'React', '19', 'لوحة SCADA والمراقبة الفورية'],
        [TOOL_CATEGORIES.LANGUAGE, 'Python', '3.12', 'نموذج التنبؤ بالأحمال والطاقة الشمسية'],
        [TOOL_CATEGORIES.SERVICE, 'HiveMQ Cloud', '2026', 'وسيط رسائل MQTT لإنترنت الأشياء'],
      ],
    },
    {
      key: 'finHub',
      yearSlot: 'curr',
      cKey: 'bus',
      dKey: 'een',
      slug: 'mnu-finhub-entrepreneurship',
      title: 'بوابة المنصورة الذكية لريادة الأعمال والتقنية المالية (MNU FinHub)',
      idea: 'منصة رقمية متكاملة لمساعدة رواد الأعمال الشباب بالدقهلية على بناء خطط العمل، تقييم الجدوى المالية، والوصول لبرامج التمويل الأصغر.',
      problem: 'تعثر أكثر من 60% من المشروعات الناشئة الطلابية بسبب ضعف التخطيط المالي وعدم توافر أدوات نمذجة مبسطة باللغة العربية.',
      objectives: [
        'تطوير حاسبة ذكية للتدفقات النقدية ونقطة التعادل متوافقة مع السوق المصري.',
        'ربط رواد الأعمال بحاضنات الأعمال ومستثمري منطقة الدلتا.',
        'توفير مؤشرات أداء مالية تفاعلية وتقارير جاهزة للعرض على الجهات الممولة.',
      ],
      scope: 'منصة ويب متكاملة تشمل محرك الجدوى المالية، دليل المستثمرين، ومسار الإرشاد الريادي.',
      field: 'business_fintech',
      type: PROJECT_TYPES.SOFTWARE,
      beneficiaries: 'طلاب الجامعات ورواد الأعمال وأصحاب المشروعات الصغيرة بمحافظة الدقهلية.',
      keywords: ['ريادة الأعمال', 'التقنية المالية', 'دراسة الجدوى', 'الشركات الناشئة', 'FinTech'],
      expectedOutcomes: 'تمكين أكثر من 200 مشروع طلابي سنوياً من إعداد خطط مالية احترافية.',
      cover: makeImageRef('cover-fintech', SEED_IMAGES.fintech, 'finhub.jpg'),
      status: PROPOSAL_STATUSES.APPROVED,
      statusFlag: STATUS_FLAGS.ON_TRACK,
      defenseState: DEFENSE_STATES.NOT_ELIGIBLE,
      leader: 'stKareemB',
      members: ['stKareemB', 'stSalmaB', 'stTarekB'],
      primarySup: 'supWalid',
      coSups: ['supMona'],
      mentors: ['invDelta'],
      phaseMode: 'three_done_one_review',
      isPublished: true,
      bom: [
        ['استضافة سحابية وقاعدة بيانات تجريبية', 1, 'باقة تشغيل لمدة سنة كاملة', 3800, 'Vercel / Railway', BOM_STATUSES.ORDERED],
        ['نطاق رسمي وشهادة أمان تجارية', 1, 'mnufinhub.eg', 1200, 'NTRA Registrar', BOM_STATUSES.RECEIVED],
      ],
      tools: [
        [TOOL_CATEGORIES.FRAMEWORK, 'React', '19', 'واجهة رواد الأعمال ولوحات التحليل المالي'],
        [TOOL_CATEGORIES.FRAMEWORK, 'Node.js', '22', 'خدمات API وحسابات النمذجة المالية'],
        [TOOL_CATEGORIES.LIBRARY, 'Recharts', '2.15', 'رسوم التدفقات النقدية ومؤشرات العائد'],
        [TOOL_CATEGORIES.SERVICE, 'MongoDB Atlas', '7.0', 'قاعدة بيانات الخطط والمشاريع'],
      ],
    },
    {
      key: 'pharmaAi',
      yearSlot: 'curr',
      cKey: 'phm',
      dKey: 'cph',
      partnerCKeys: ['eng'],
      partnerDKeys: ['aie'],
      slug: 'mnu-clinical-pharmacist-ai',
      title: 'مساعد الصيدلي الإكلينيكي الذكي لرصد التداخلات الدوائية',
      idea: 'تطبيق ذكي يعتمد على استرجاع المعرفة الدوائية الموثقة (RAG) لفحص الروشتات والملفات الدوائية وتنبيه الصيدلي الإكلينيكي بالتداخلات الخطرة وضبط الجرعات.',
      problem: 'تزايد الأخطاء الدوائية الناتجة عن تعدد الأدوية (Polypharmacy) لدى كبار السن ومرضى القصور الكلوي بالمستشفيات.',
      objectives: [
        'بناء قاعدة معرفة دوائية محدثة متضمنة الأسماء التجارية المتداولة في السوق المصري.',
        'تطوير محرك رصد فوري للتداخلات الدوائية وتصنيفها حسب درجة الخطورة.',
        'حساب الجرعات المعدلة تلقائياً بناءً على وظائف الكلى والكبد.',
      ],
      scope: 'نظام ويب وتطبيق مساعد للصيادلة الإكلينيكيين مع اختبار تحقق على 150 حالة سريرية مرجعية.',
      field: 'ai',
      type: PROJECT_TYPES.SOFTWARE,
      beneficiaries: 'الصيادلة الإكلينيكيون والأطباء ومرضى الأمراض المزمنة.',
      keywords: ['الصيدلة الإكلينيكية', 'التداخلات الدوائية', 'RAG', 'الذكاء الاصطناعي', 'Pharm-D'],
      expectedOutcomes: 'خفض احتمالية التداخلات الدوائية الخطرة بنسبة 85% في الاختبارات السريرية المحاكاة.',
      cover: makeImageRef('cover-pharma', SEED_IMAGES.pharmacy, 'pharma-ai.jpg'),
      status: PROPOSAL_STATUSES.APPROVED,
      statusFlag: STATUS_FLAGS.ON_TRACK,
      defenseState: DEFENSE_STATES.NOT_ELIGIBLE,
      leader: 'stNadaP',
      members: ['stNadaP', 'stMostafaP', 'stYaraP'],
      primarySup: 'supYasser',
      coSups: ['supTarek'],
      mentors: [],
      phaseMode: 'three_done_late',
      isPublished: false,
      bom: [
        ['واجهة برمجة نماذج لغوية وقاعدة متجهات', 1, 'رصيد تطوير واختبار لمدة 6 أشهر', 4200, 'Vector Cloud', BOM_STATUSES.RECEIVED],
      ],
      tools: [
        [TOOL_CATEGORIES.LANGUAGE, 'Python', '3.12', 'محرك استرجاع المعرفة الدوائية RAG'],
        [TOOL_CATEGORIES.FRAMEWORK, 'FastAPI', '0.115', 'خدمات فحص التداخلات وضبط الجرعات'],
        [TOOL_CATEGORIES.FRAMEWORK, 'React', '19', 'واجهة الصيدلي الإكلينيكي'],
        [TOOL_CATEGORIES.LIBRARY, 'LangChain', '0.3', 'سلسلة التحقق المرجعي والاستشهاد بالمصادر'],
      ],
    },
    {
      key: 'agriDrone',
      yearSlot: 'curr',
      cKey: 'eng',
      dKey: 'cce',
      slug: 'mnu-dakahlia-agri-drone',
      title: 'نظام ملاحة ذاتي لطائرة بدون طيار لمراقبة المحاصيل الزراعية بالدقهلية',
      idea: 'طائرة مسيّرة ذاتية الملاحة مزودة بكاميرا متعددة الأطياف لرصد إجهاد المحاصيل الزراعية (الأرز والقمح) وتحديد مناطق الري والتسميد بدقة.',
      problem: 'إهدار كميات كبيرة من مياه الري والأسمدة وتأخر اكتشاف الإصابات الفطرية في الأراضي الزراعية بمحافظة الدقهلية.',
      objectives: [
        'بناء طائرة رباعية المراوح بملاحة مستقلة باستخدام Pixhawk وGPS عالي الدقة.',
        'حساب مؤشر الغطاء النباتي NDVI آلياً عبر معالجة الصور على Raspberry Pi.',
        'إصدار خرائط حرارية للمزارع عبر تطبيق هاتف يعمل باللغة العربية.',
      ],
      scope: 'نموذج أولي ميداني لتغطية 5 أفدنة في الطلعة الواحدة مع لوحة تحكم خرائطية.',
      field: 'robotics',
      type: PROJECT_TYPES.HYBRID,
      beneficiaries: 'المزارعون، الجمعيات الزراعية، ومشروعات استصلاح الأراضي بالدلتا.',
      keywords: ['الروبوتات', 'الطائرات المسيرة', 'الزراعة الذكية', 'NDVI', 'Pixhawk'],
      expectedOutcomes: 'توفير 30% من مياه الري واكتشاف أمراض المحاصيل قبل أسبوعين من ظهورها بالعين المجردة.',
      cover: makeImageRef('cover-drone', SEED_IMAGES.droneAgri, 'agri-drone.jpg'),
      status: PROPOSAL_STATUSES.APPROVED,
      statusFlag: STATUS_FLAGS.AT_RISK,
      defenseState: DEFENSE_STATES.NOT_ELIGIBLE,
      leader: 'stAbdelrahman',
      members: ['stAbdelrahman', 'stSeif', 'stMalak'],
      primarySup: 'supHeba',
      coSups: ['supKarim'],
      mentors: [],
      phaseMode: 'two_done_changes_req',
      isPublished: false,
      bom: [
        ['متحكم طيران Pixhawk 6C مع وحدة GPS M9N', 1, 'ملاحة مستقلة ومستشعرات IMU مزدوجة', 9200, 'DroneLab Cairo', BOM_STATUSES.RECEIVED],
        ['حاسوب Raspberry Pi 5 (8GB) وكاميرا NoIR', 1, 'معالجة صور الغطاء النباتي NDVI', 5400, 'RAM Electronics', BOM_STATUSES.RECEIVED],
        ['هيكل كربون فايبر 450mm ومحركات Brushless', 1, 'طقم 4 محركات 920KV مع ESC 40A', 6800, 'RC Egypt', BOM_STATUSES.ORDERED],
        ['بطارية LiPo 4S 6000mAh وشاحن ذكي', 2, 'زمن طيران حتى 22 دقيقة', 3200, 'RC Egypt', BOM_STATUSES.NEEDED],
      ],
      tools: [
        [TOOL_CATEGORIES.LANGUAGE, 'C++', '20', 'برمجة الملاحة والتحكم عبر MAVLink'],
        [TOOL_CATEGORIES.LANGUAGE, 'Python', '3.12', 'تحليل الصور وحساب مؤشر NDVI'],
        [TOOL_CATEGORIES.LIBRARY, 'OpenCV', '4.10', 'معالجة الصور الجوية وتصحيح التشوه'],
        [TOOL_CATEGORIES.FRAMEWORK, 'Flutter', '3.27', 'تطبيق خرائط المزارع والتنبيهات'],
      ],
    },
    {
      key: 'greenCampus',
      yearSlot: 'curr',
      cKey: 'eng',
      dKey: 'sar',
      slug: 'mnu-zero-emission-student-hub',
      title: 'تصميم مجمّع طلابي مستدام خالي من الانبعاثات بمدينة المنصورة الجديدة',
      idea: 'تصميم معماري وبيئي متكامل لمركز أنشطة طلابية ومختبرات ابتكار بجامعة المنصورة الأهلية يحقق صافي طاقة صفري (Net-Zero) بتقنيات BIM.',
      problem: 'ارتفاع الاستهلاك الحراري والكهربائي للمباني التعليمية الساحلية نتيجة المناخ الحار الرطب بمدينة المنصورة الجديدة.',
      objectives: [
        'تصميم واجهات مزدوجة وكاسرات شمسية ذكية تخفض الأحمال الحرارية بنسبة 40%.',
        'محاكاة الإضاءة الطبيعية والتهوية السلبية عبر EnergyPlus وLadybug.',
        'دمج أنظمة إعادة تدوير المياه الرمادية والأسطح الخضراء.',
      ],
      scope: 'نموذج BIM متكامل (LOD 350)، لوحات معمارية تنفيذية، وتقرير محاكاة أداء الطاقة السنوي.',
      field: 'civil_architecture',
      type: PROJECT_TYPES.DESIGN,
      beneficiaries: 'الطلاب وهيئة التدريس والمخططون العمرانيون بمدينة المنصورة الجديدة.',
      keywords: ['العمارة المستدامة', 'BIM', 'Net-Zero', 'المنصورة الجديدة', 'Revit'],
      expectedOutcomes: 'نموذج مرجعي للمباني الجامعية الخضراء في المدن الساحلية المصرية.',
      cover: makeImageRef('cover-arch', SEED_IMAGES.architecture, 'green-campus.jpg'),
      status: PROPOSAL_STATUSES.APPROVED,
      statusFlag: STATUS_FLAGS.DELAYED,
      defenseState: DEFENSE_STATES.NOT_ELIGIBLE,
      leader: 'stFarah',
      members: ['stFarah', 'stAdham'],
      primarySup: 'supAmr',
      coSups: [],
      mentors: [],
      phaseMode: 'one_done_delayed',
      isPublished: false,
      bom: [
        ['خامات ماكيت معماري مقطوع بالليزر (مقياس 1:100)', 1, 'أكريليك وخشب بلسا وإضاءة LED', 5800, 'استوديو المنصورة للنماذج', BOM_STATUSES.NEEDED],
      ],
      tools: [
        [TOOL_CATEGORIES.OTHER, 'Autodesk Revit', '2025', 'نمذجة معلومات المباني BIM'],
        [TOOL_CATEGORIES.OTHER, 'Rhino 3D + Grasshopper', '8', 'التصميم البارامتري للواجهات'],
        [TOOL_CATEGORIES.SERVICE, 'EnergyPlus', '24.2', 'محاكاة كفاءة الطاقة والأحمال الحرارية'],
      ],
    },
    {
      key: 'icuMonitor',
      yearSlot: 'curr',
      cKey: 'nur',
      dKey: 'ccn',
      slug: 'mnu-icu-early-warning-platform',
      title: 'منصة المراقبة الذكية لمرضى العناية المركزة والتنبيه المبكر',
      idea: 'نظام دعم تمريضي رقمي يطبق مقياس الإنذار المبكر الوطني (NEWS2) للتنبؤ بتدهور حالة مرضى العناية المركزة وتنسيق استجابة الفريق الطبي.',
      problem: 'التسجيل الورقي المتأخر للعلامات الحيوية في وحدات العناية المركزة قد يؤدي إلى تأخر رصد التدهور السريري الحاد.',
      objectives: [
        'أتمتة حساب مؤشر NEWS2 وتصنيف مستوى الخطورة لكل مريض لحظياً.',
        'توفير قائمة تحقق إلكترونية لبروتوكولات الاستجابة السريعة للتمريض.',
        'توثيق تسليم الورديات التمريضية (SBAR) بدقة وتقليل الأخطاء التواصلية.',
      ],
      scope: 'تطبيق ويب تجريبي للوحدات السريرية وتقييم قابليته للاستخدام بمشاركة 25 ممرضاً وممرضة.',
      field: 'biomedical',
      type: PROJECT_TYPES.RESEARCH,
      beneficiaries: 'أطقم التمريض بوحدات العناية الحرجة ومرضى المستشفيات الجامعية.',
      keywords: ['تمريض العناية الحرجة', 'NEWS2', 'الإنذار المبكر', 'سلامة المرضى'],
      expectedOutcomes: 'تحسين سرعة الاستجابة للتدهور السريري ورفع جودة تسليم الورديات التمريضية.',
      cover: makeImageRef('cover-icu', SEED_IMAGES.icuMonitor, 'icu-monitor.jpg'),
      status: PROPOSAL_STATUSES.APPROVED,
      statusFlag: STATUS_FLAGS.ON_TRACK,
      defenseState: DEFENSE_STATES.ELIGIBLE,
      leader: 'stEsraaN',
      members: ['stEsraaN', 'stHagerN'],
      primarySup: 'supEman',
      coSups: ['supSalwa'],
      mentors: [],
      phaseMode: 'all_approved',
      isPublished: false,
      bom: [],
      tools: [
        [TOOL_CATEGORIES.FRAMEWORK, 'React', '19', 'لوحة العلامات الحيوية والإنذار المبكر'],
        [TOOL_CATEGORIES.FRAMEWORK, 'Node.js', '22', 'إدارة سجلات المتابعة والتنبيهات'],
        [TOOL_CATEGORIES.LIBRARY, 'SPSS', '29', 'التحليل الإحصائي لنتائج الدراسة الميدانية'],
      ],
    },
    // --- Proposals in review/workflow stages (Current Year 2026/2027) ---
    {
      key: 'deltaEcom',
      yearSlot: 'curr',
      cKey: 'bus',
      dKey: 'dmo',
      slug: 'mnu-delta-sme-ecommerce-analytics',
      title: 'نظام تحليل اتجاهات التجارة الإلكترونية للمشروعات الصغيرة بالدلتا',
      idea: 'لوحة تحليلات تسويقية عربية تقيس أداء الحملات الإعلانية وسلوك المستهلكين للمتاجر الإلكترونية الصغيرة في محافظات الدلتا.',
      problem: 'إهدار ميزانيات التسويق الرقمي للمشروعات الصغيرة بسبب غياب أدوات تحليل مبسطة تقيس العائد الفعلي على الإنفاق.',
      objectives: [
        'توحيد بيانات المبيعات وحملات التواصل الاجتماعي في لوحة مؤشرات واحدة.',
        'تقديم توصيات تسعير واستهداف مدعومة بتحليل سلوك العملاء.',
      ],
      scope: 'منصة تحليلات SaaS موجهة لـ 30 متجراً إلكترونياً تجريبياً بمدينة المنصورة.',
      field: 'data_science',
      type: PROJECT_TYPES.SOFTWARE,
      beneficiaries: 'أصحاب المتاجر الإلكترونية والمسوقون الرقميون بالدقهلية.',
      keywords: ['التسويق الرقمي', 'التجارة الإلكترونية', 'تحليل البيانات', 'Power BI'],
      expectedOutcomes: 'رفع العائد على الإنفاق الإعلاني بنسبة 25% للمشروعات المشاركة.',
      cover: makeImageRef('cover-ecom', SEED_IMAGES.ecommerce, 'ecommerce.jpg'),
      status: PROPOSAL_STATUSES.SUPERVISOR_RECOMMENDED,
      statusFlag: STATUS_FLAGS.ON_TRACK,
      defenseState: DEFENSE_STATES.NOT_ELIGIBLE,
      leader: 'stBassel',
      members: ['stBassel', 'stNermine'],
      primarySup: null,
      preferredSup: 'supMona',
      reviewerSup: 'supMona',
      coSups: [],
      mentors: [],
      phaseMode: 'none',
      isPublished: false,
      bom: [],
      tools: [],
    },
    {
      key: 'hospCyber',
      yearSlot: 'curr',
      cKey: 'eng',
      dKey: 'cce',
      slug: 'mnu-hospital-cyber-defense',
      title: 'نظام أمن سيبراني لحماية الشبكات الطبية في المستشفيات الجامعية',
      idea: 'نظام كشف تسلل ذكي (IDS) مخصص لشبكات الأجهزة الطبية المتصلة (IoMT) لحماية بيانات المرضى من هجمات الفدية والاختراق.',
      problem: 'ضعف الحماية الأمنية في الأجهزة الطبية الشبكية وتزايد استهداف المستشفيات بهجمات الفدية الإلكترونية.',
      objectives: [
        'تحليل حركة الشبكة الطبية ورصد الأنماط الشاذة بالتعلم الآلي.',
        'عزل الأجهزة المصابة تلقائياً دون التأثير على استمرارية الرعاية الحرجة.',
      ],
      scope: 'بيئة محاكاة لشبكة مستشفى ذكي مع لوحة SIEM لتنبيهات الحوادث الفورية.',
      field: 'cybersecurity',
      type: PROJECT_TYPES.SOFTWARE,
      beneficiaries: 'إدارات تقنية المعلومات وأمن المعلومات بالمستشفيات الجامعية.',
      keywords: ['الأمن السيبراني', 'IoMT', 'كشف التسلل', 'SIEM', 'أمن الشبكات'],
      expectedOutcomes: 'رصد 96% من محاولات الاختراق في بيئة الاختبار بزمن استجابة أقل من 3 ثوانٍ.',
      cover: makeImageRef('cover-cyber', SEED_IMAGES.cybersec, 'cybersec.jpg'),
      status: PROPOSAL_STATUSES.UNDER_REVIEW,
      statusFlag: STATUS_FLAGS.ON_TRACK,
      defenseState: DEFENSE_STATES.NOT_ELIGIBLE,
      leader: 'stMoaz',
      members: ['stMoaz', 'stAyman'],
      primarySup: null,
      preferredSup: 'supTarek',
      reviewerSup: 'supTarek',
      coSups: [],
      mentors: [],
      phaseMode: 'none',
      isPublished: false,
      bom: [],
      tools: [],
    },
    {
      key: 'chronicApp',
      yearSlot: 'curr',
      cKey: 'med',
      dKey: 'mbbs',
      slug: 'mnu-chronic-disease-student-care',
      title: 'تطبيق التوعية والمتابعة الذكية للأمراض المزمنة لطلاب الجامعة',
      idea: 'تطبيق صحي جامعي يتيح للطلاب المصابين بالسكري أو الربو متابعة قياساتهم والتواصل مع العيادة الطبية بجامعة المنصورة الأهلية.',
      problem: 'غياب سجل متابعة رقمي للطلاب أصحاب الحالات المزمنة داخل الحرم الجامعي أثناء الأنشطة والامتحانات.',
      objectives: [
        'توفير بطاقة طوارئ رقمية وتنبيهات مواعيد الدواء.',
        'ربط التطبيق بالإدارة الطبية الجامعية للحالات الحرجة.',
      ],
      scope: 'تطبيق جوال وبوابة للعيادة الجامعية مع دراسة ميدانية على عينة من الطلاب.',
      field: 'biomedical',
      type: PROJECT_TYPES.SOFTWARE,
      beneficiaries: 'طلاب جامعة المنصورة الأهلية والإدارة الطبية بالجامعة.',
      keywords: ['الصحة الجامعية', 'الأمراض المزمنة', 'الطب الوقائي'],
      expectedOutcomes: 'تحسين التزام الطلاب بالخطة العلاجية وتقليل مضاعفات الطوارئ داخل الحرم.',
      cover: makeImageRef('cover-med', SEED_IMAGES.medicalApp, 'medical-app.jpg'),
      status: PROPOSAL_STATUSES.NEEDS_CHANGES,
      statusFlag: STATUS_FLAGS.ON_TRACK,
      defenseState: DEFENSE_STATES.NOT_ELIGIBLE,
      leader: 'stHanaM',
      members: ['stHanaM', 'stAliM'],
      primarySup: null,
      preferredSup: 'supSalwa',
      reviewerSup: 'supSalwa',
      coSups: [],
      mentors: [],
      phaseMode: 'none',
      isPublished: false,
      bom: [],
      tools: [],
    },
    {
      key: 'startupFinance',
      yearSlot: 'curr',
      cKey: 'bus',
      dKey: 'ecf',
      slug: 'mnu-startup-financial-analyzer',
      title: 'منصة التحليل المالي الآلي للشركات الناشئة المصرية',
      idea: 'أداة ذكية لقراءة القوائم المالية للشركات الناشئة وحساب مؤشرات التقييم المالي ومخاطر السيولة وفق معايير المحاسبة المصرية.',
      problem: 'صعوبة تقييم الجدارة المالية للشركات الناشئة من قبل المستثمرين والمؤسسين غير المتخصصين مالياً.',
      objectives: [
        'أتمتة استخراج النسب المالية وتحليل الحساسية من ملفات Excel.',
        'إصدار تقرير تقييم مبدئي يساعد في جولات التمويل البذري.',
      ],
      scope: 'تطبيق ويب للتحليل المالي متكامل مع نماذج تقييم التدفقات المخصومة DCF.',
      field: 'business_fintech',
      type: PROJECT_TYPES.SOFTWARE,
      beneficiaries: 'الشركات الناشئة، المسرّعات، ومستثمرو المراحل المبكرة.',
      keywords: ['التحليل المالي', 'الشركات الناشئة', 'DCF', 'الاقتصاد والتمويل'],
      expectedOutcomes: 'تقليص زمن إعداد التحليل المالي الأولي من أسبوعين إلى دقائق معدودة.',
      cover: null,
      status: PROPOSAL_STATUSES.SUBMITTED,
      statusFlag: STATUS_FLAGS.ON_TRACK,
      defenseState: DEFENSE_STATES.NOT_ELIGIBLE,
      leader: 'stLailaF',
      members: ['stLailaF', 'stRamyF'],
      primarySup: null,
      preferredSup: 'supWalid',
      reviewerSup: null,
      coSups: [],
      mentors: [],
      phaseMode: 'none',
      isPublished: false,
      bom: [],
      tools: [],
    },
    {
      key: 'pharmaDraft',
      yearSlot: 'curr',
      cKey: 'phm',
      dKey: 'pht',
      slug: 'mnu-smart-formulation-qc',
      title: 'نظام ذكي لضبط جودة التركيبات الصيدلية ومراقبة الثبات الدوائي',
      idea: 'منصة معملية لتسجيل اختبارات الثبات الدوائي والتنبؤ بفترة الصلاحية للمستحضرات الصيدلية الموضعية.',
      problem: 'اعتماد معامل التركيبات على سجلات ورقية يصعب تحليل اتجاهات الجودة والثبات من خلالها.',
      objectives: [
        'رقمنة سجلات اختبارات الجودة والثبات المسرّع.',
        'توليد تقارير مطابقة لمواصفات دستور الأدوية.',
      ],
      scope: 'نموذج برمجي مبدئي موجه لمعامل كلية الصيدلة بجامعة المنصورة الأهلية.',
      field: 'data_science',
      type: PROJECT_TYPES.RESEARCH,
      beneficiaries: 'طلاب وباحثو معامل التكنولوجيا الصيدلية وشركات الدواء.',
      keywords: ['التكنولوجيا الصيدلية', 'ضبط الجودة', 'الثبات الدوائي'],
      expectedOutcomes: 'رفع دقة التوثيق المعملي وسرعة اكتشاف الانحرافات في التركيبات.',
      cover: null,
      status: PROPOSAL_STATUSES.DRAFT,
      statusFlag: STATUS_FLAGS.ON_TRACK,
      defenseState: DEFENSE_STATES.NOT_ELIGIBLE,
      leader: 'stDaliaP',
      members: ['stDaliaP'],
      primarySup: null,
      preferredSup: 'supYasser',
      reviewerSup: null,
      coSups: [],
      mentors: [],
      phaseMode: 'none',
      isPublished: false,
      bom: [],
      tools: [],
    },

    // ---------- PREVIOUS ARCHIVED YEAR 2025/2026 (For YoY Reports & Showcase!) ----------
    {
      key: 'medWaste',
      yearSlot: 'prev',
      cKey: 'phm',
      dKey: 'pht',
      slug: 'mnu-smart-medical-waste-management',
      title: 'منصة ذكية لإدارة المخلفات الطبية وإعادة التدوير الآمن',
      idea: 'نظام تتبع ذكي لحاويات المخلفات الطبية الخطرة في المستشفيات باستخدام بطاقات RFID ومستشعرات وزن لضمان التخلص الآمن والمطابق للمعايير البيئية.',
      problem: 'صعوبة تتبع مسار المخلفات الطبية من الأقسام السريرية حتى محطات التعقيم مما يشكل خطراً بيئياً وصحياً.',
      objectives: [
        'تصميم حاوية ذكية تقيس مستوى الامتلاء وتسجل هوية المسؤول ببطاقة RFID.',
        'بناء لوحة تحكم لإدارة مسارات الجمع والتعقيم وتوليد شهادات التتبع البيئي.',
      ],
      scope: 'نموذج أولي متكامل تم اختباره بنجاح في المعامل المركزية بجامعة المنصورة الأهلية.',
      field: 'iot_embedded',
      type: PROJECT_TYPES.HYBRID,
      beneficiaries: 'المستشفيات والمراكز الطبية وهيئات حماية البيئة.',
      keywords: ['المخلفات الطبية', 'RFID', 'الاستدامة', 'IoT', 'الصيدلة'],
      expectedOutcomes: 'تحقيق تتبع بنسبة 100% وخفض تكلفة نقل المخلفات بنسبة 20%.',
      cover: makeImageRef('cover-medwaste', SEED_IMAGES.medWaste, 'med-waste.jpg'),
      status: PROPOSAL_STATUSES.ARCHIVED,
      statusFlag: STATUS_FLAGS.ON_TRACK,
      defenseState: DEFENSE_STATES.FINALIZED,
      leader: 'stPrev1',
      members: ['stPrev1', 'stPrev2'],
      primarySup: 'supYasser',
      coSups: ['supHeba'],
      mentors: [],
      phaseMode: 'all_approved',
      isPublished: true,
      bom: [
        ['قارئ RFID RC522 وبطاقات مشفرة', 4, 'توثيق تسليم الحاويات', 650, 'RAM Electronics', BOM_STATUSES.RECEIVED],
        ['حساسات وزن Load Cell 50kg مع HX711', 4, 'قياس كمية المخلفات بدقة', 1100, 'Future Electronics EG', BOM_STATUSES.RECEIVED],
        ['وحدة ESP32 + شاشة OLED', 2, 'اتصال لاسلكي بلوحة المتابعة', 950, 'RAM Electronics', BOM_STATUSES.RECEIVED],
      ],
      tools: [
        [TOOL_CATEGORIES.FRAMEWORK, 'Node.js', '20', 'خادم التتبع وإصدار تقارير التوافق'],
        [TOOL_CATEGORIES.FRAMEWORK, 'React', '18', 'لوحة متابعة المستشفى ومسارات الجمع'],
        [TOOL_CATEGORIES.SERVICE, 'MongoDB Atlas', '7.0', 'سجل الشحنات والتعقيم'],
      ],
    },
    {
      key: 'waterRobot',
      yearSlot: 'prev',
      cKey: 'eng',
      dKey: 'mct',
      slug: 'mnu-ultrasonic-water-pipe-robot',
      title: 'روبوت فحص شبكات المياه وكشف التسربات بالموجات فوق الصوتية',
      idea: 'روبوت أنبوبي ذاتي الحركة يفحص خطوط مياه الشرب ويكشف التسربات والشروخ الدقيقة باستخدام الموجات فوق الصوتية وكاميرا عالية الإضاءة.',
      problem: 'فقدان أكثر من 25% من مياه الشرب في الشبكات الحضرية بسبب التسربات غير المرئية تحت الأرض.',
      objectives: [
        'تصميم هيكل روبوتي مقاوم للماء يناسب أقطار مواسير 150–300 مم.',
        'تحليل الإشارات الصوتية لتحديد موقع التسرب بدقة تقل عن 15 سم.',
      ],
      scope: 'نموذج ميكانيكي وإلكتروني كامل مع وحدة تحكم سطحية وتطبيق عرض خرائط الأعطال.',
      field: 'robotics',
      type: PROJECT_TYPES.HARDWARE,
      beneficiaries: 'شركات مياه الشرب والصرف الصحي والمدن الجديدة.',
      keywords: ['الروبوتات', 'كشف التسربات', 'الموجات فوق الصوتية', 'الميكاترونكس'],
      expectedOutcomes: 'خفض زمن وتكلفة اكتشاف الأعطال دون الحاجة للحفر العشوائي.',
      cover: makeImageRef('cover-waterbot', SEED_IMAGES.waterRobot, 'water-robot.jpg'),
      status: PROPOSAL_STATUSES.ARCHIVED,
      statusFlag: STATUS_FLAGS.ON_TRACK,
      defenseState: DEFENSE_STATES.FINALIZED,
      leader: 'stPrev3',
      members: ['stPrev3', 'stPrev4'],
      primarySup: 'supKarim',
      coSups: [],
      mentors: [],
      phaseMode: 'all_approved',
      isPublished: true,
      bom: [
        ['هيكل ألومنيوم مقاوم للماء IP68', 1, 'تشغيل داخل الأنابيب الرطبة', 7200, 'ورشة الهندسة المنصورة', BOM_STATUSES.RECEIVED],
        ['حساسات موجات فوق صوتية صناعية وكاميرا IP', 2, 'كشف الشروخ والبث المباشر', 5400, 'Robokits Cairo', BOM_STATUSES.RECEIVED],
        ['محركات DC بعزم عالٍ مع وحدة قيادة L298N', 4, 'حركة ثنائية الاتجاه داخل الأنابيب', 2400, 'RAM Electronics', BOM_STATUSES.RECEIVED],
      ],
      tools: [
        [TOOL_CATEGORIES.LANGUAGE, 'C++', '17', 'التحكم الحركي وقراءة الحساسات'],
        [TOOL_CATEGORIES.LANGUAGE, 'Python', '3.11', 'معالجة الإشارات الصوتية وكشف التسرب'],
        [TOOL_CATEGORIES.OTHER, 'SolidWorks', '2024', 'تصميم الهيكل المقاوم للماء'],
      ],
    },
    {
      key: 'diabetesCds',
      yearSlot: 'prev',
      cKey: 'med',
      dKey: 'mbbs',
      slug: 'mnu-diabetes-clinical-decision-support',
      title: 'نظام دعم القرار السريري لمرضى السكري بمستشفيات المنصورة',
      idea: 'نظام ذكي يدعم أطباء الباطنة والغدد الصماء في تخصيص الخطط العلاجية لمرضى السكري من النوع الثاني والتنبؤ بمضاعفات الكلى والأوعية.',
      problem: 'تباين استجابة مرضى السكري للعلاج وصعوبة تتبع التغيرات التراكمية للتحاليل في العيادات المزدحمة.',
      objectives: [
        'تحليل السجلات الدورية للسكر التراكمي HbA1c ووظائف الكلى.',
        'تقديم توصيات إرشادية متوافقة مع دليل الجمعية الأمريكية للسكري ADA.',
      ],
      scope: 'نظام ويب سريري تم تقييمه على بيانات تاريخية مجهولة الهوية لـ 400 مريض.',
      field: 'data_science',
      type: PROJECT_TYPES.RESEARCH,
      beneficiaries: 'أطباء الباطنة والغدد الصماء ومرضى السكري بالدقهلية.',
      keywords: ['السكري', 'دعم القرار السريري', 'علم البيانات الطبية', 'ADA'],
      expectedOutcomes: 'تحسين دقة ضبط الخطط العلاجية وتقليل زيارات الطوارئ المتكررة.',
      cover: makeImageRef('cover-diabetes', SEED_IMAGES.diabetesCds, 'diabetes-cds.jpg'),
      status: PROPOSAL_STATUSES.ARCHIVED,
      statusFlag: STATUS_FLAGS.ON_TRACK,
      defenseState: DEFENSE_STATES.REEVALUATION_REQUESTED,
      leader: 'stPrev5',
      members: ['stPrev5', 'stPrev6'],
      primarySup: 'supSalwa',
      coSups: ['supTarek'],
      mentors: [],
      phaseMode: 'all_approved',
      isPublished: true,
      bom: [],
      tools: [
        [TOOL_CATEGORIES.LANGUAGE, 'Python', '3.11', 'تحليل البيانات والنماذج التنبؤية'],
        [TOOL_CATEGORIES.LIBRARY, 'Scikit-learn', '1.5', 'نماذج التنبؤ بالمضاعفات'],
        [TOOL_CATEGORIES.FRAMEWORK, 'React', '18', 'واجهة الأطباء ومؤشرات المريض'],
      ],
    },
    {
      key: 'crowdfund',
      yearSlot: 'prev',
      cKey: 'bus',
      dKey: 'een',
      slug: 'mnu-dakahlia-craft-crowdfunding',
      title: 'منصة التمويل الجماعي للمشروعات الطلابية والحرفية بالدقهلية',
      idea: 'منصة تمويل جماعي قائمة على المكافآت تدعم الحرفيين والطلاب المبتكرين بمحافظة الدقهلية لإطلاق منتجاتهم الأولى.',
      problem: 'فجوة التمويل الأولي للمشروعات الحرفية والنماذج الطلابية الواعدة قبل مرحلة التأسيس التجاري.',
      objectives: [
        'تطوير بوابة حملات تمويل شفافة بنظام مراحل إطلاق الأموال.',
        'دمج أدوات تسويق رقمي وتقييم مجتمعي للحملات.',
      ],
      scope: 'منصة ويب كاملة تم تجربتها مع 12 مشروعاً حرفياً وطلابياً بالمنصورة.',
      field: 'business_fintech',
      type: PROJECT_TYPES.SOFTWARE,
      beneficiaries: 'الحرفيون والطلاب المبتكرون والداعمون المحليون بالدقهلية.',
      keywords: ['التمويل الجماعي', 'الحرف اليدوية', 'ريادة الأعمال', 'الدقهلية'],
      expectedOutcomes: 'إطلاق نموذج اقتصادي مجتمعي يدعم التحول الرقمي للمنتجات المحلية.',
      cover: makeImageRef('cover-crowd', SEED_IMAGES.crowdfund, 'crowdfunding.jpg'),
      status: PROPOSAL_STATUSES.ARCHIVED,
      statusFlag: STATUS_FLAGS.ON_TRACK,
      defenseState: DEFENSE_STATES.FINALIZED,
      leader: 'stPrev7',
      members: ['stPrev7', 'stPrev8'],
      primarySup: 'supWalid',
      coSups: [],
      mentors: [],
      phaseMode: 'all_approved',
      isPublished: true,
      bom: [],
      tools: [
        [TOOL_CATEGORIES.FRAMEWORK, 'React', '18', 'بوابة الحملات والمدفوعات'],
        [TOOL_CATEGORIES.FRAMEWORK, 'Node.js', '20', 'إدارة الحملات والمحافظ'],
        [TOOL_CATEGORIES.SERVICE, 'MongoDB Atlas', '7.0', 'قاعدة البيانات الرئيسية'],
      ],
    },
  ];

  for (const def of projectDefs) {
    const col = colleges[def.cKey];
    const dept = departments[def.dKey];
    const ay = years[def.yearSlot][def.cKey];
    const leaderUser = users[def.leader];
    const memberUsers = def.members.map((k) => users[k]);
    const primarySupUser = def.primarySup ? users[def.primarySup] : null;
    const preferredSupUser = def.preferredSup ? users[def.preferredSup] : primarySupUser;
    const reviewerSupUser = def.reviewerSup ? users[def.reviewerSup] : primarySupUser;
    const coSupUsers = (def.coSups || []).map((k) => users[k]);
    const mentorUsers = (def.mentors || []).map((k) => users[k]);

    const collegeAdminKey = `${def.cKey}Admin`;
    const collegeAdminUser = users[collegeAdminKey];

    const history = [];
    const baseAgo = def.yearSlot === 'prev' ? 320 : 85;
    if (def.status !== PROPOSAL_STATUSES.DRAFT) {
      history.push({
        from: PROPOSAL_STATUSES.DRAFT,
        to: PROPOSAL_STATUSES.SUBMITTED,
        event: 'SUBMIT',
        actorId: leaderUser._id,
        actorRole: 'student',
        comment: 'تم تقديم مقترح المشروع بعد استكمال بيانات الفريق والأهداف.',
        at: daysAgo(baseAgo),
      });
    }
    if (
      [
        PROPOSAL_STATUSES.UNDER_REVIEW,
        PROPOSAL_STATUSES.NEEDS_CHANGES,
        PROPOSAL_STATUSES.SUPERVISOR_RECOMMENDED,
        PROPOSAL_STATUSES.APPROVED,
        PROPOSAL_STATUSES.ARCHIVED,
      ].includes(def.status)
    ) {
      history.push({
        from: PROPOSAL_STATUSES.SUBMITTED,
        to: PROPOSAL_STATUSES.UNDER_REVIEW,
        event: 'START_REVIEW',
        actorId: (reviewerSupUser || collegeAdminUser)._id,
        actorRole: 'supervisor',
        comment: 'تم استلام المقترح لبدء المراجعة العلمية والأكاديمية.',
        at: daysAgo(baseAgo - 2),
      });
    }
    if (def.status === PROPOSAL_STATUSES.NEEDS_CHANGES) {
      history.push({
        from: PROPOSAL_STATUSES.UNDER_REVIEW,
        to: PROPOSAL_STATUSES.NEEDS_CHANGES,
        event: 'REQUEST_CHANGES',
        actorId: reviewerSupUser._id,
        actorRole: 'supervisor',
        comment: 'يرجى توضيح آلية حماية خصوصية البيانات الطبية وتحديد عينة الدراسة الميدانية بدقة أكبر.',
        at: daysAgo(baseAgo - 5),
      });
    }
    if (
      [
        PROPOSAL_STATUSES.SUPERVISOR_RECOMMENDED,
        PROPOSAL_STATUSES.APPROVED,
        PROPOSAL_STATUSES.ARCHIVED,
      ].includes(def.status)
    ) {
      history.push({
        from: PROPOSAL_STATUSES.UNDER_REVIEW,
        to: PROPOSAL_STATUSES.SUPERVISOR_RECOMMENDED,
        event: 'RECOMMEND',
        actorId: (reviewerSupUser || primarySupUser)._id,
        actorRole: 'supervisor',
        comment: 'فكرة متميزة ذات أثر تطبيقي واضح ونطاق تنفيذي واقعي؛ أوصي بالاعتماد.',
        at: daysAgo(baseAgo - 5),
      });
    }
    if ([PROPOSAL_STATUSES.APPROVED, PROPOSAL_STATUSES.ARCHIVED].includes(def.status)) {
      history.push({
        from: PROPOSAL_STATUSES.SUPERVISOR_RECOMMENDED,
        to: PROPOSAL_STATUSES.APPROVED,
        event: 'APPROVE',
        actorId: collegeAdminUser._id,
        actorRole: 'collegeAdmin',
        comment: 'تم اعتماد المشروع رسمياً وفتح مراحل التنفيذ للعام الأكاديمي.',
        at: daysAgo(baseAgo - 8),
      });
    }
    if (def.status === PROPOSAL_STATUSES.ARCHIVED) {
      history.push({
        from: PROPOSAL_STATUSES.APPROVED,
        to: PROPOSAL_STATUSES.ARCHIVED,
        event: 'YEAR_ROLLOVER',
        actorId: users.uniAdmin._id,
        actorRole: 'universityAdmin',
        comment: 'تمت أرشفة المشروع مع إغلاق العام الأكاديمي 2025/2026.',
        at: daysAgo(90),
      });
    }

    const totalBudget = (def.bom || []).reduce((sum, item) => sum + item[1] * item[3], 0);
    const signedOff =
      def.defenseState !== DEFENSE_STATES.NOT_ELIGIBLE && primarySupUser
        ? { by: primarySupUser._id, at: daysAgo(def.yearSlot === 'prev' ? 130 : 18) }
        : undefined;

    const project = await Project.create({
      title: def.title,
      slug: def.slug,
      idea: def.idea,
      problem: def.problem,
      objectives: def.objectives,
      scope: def.scope,
      field: def.field,
      type: def.type,
      beneficiaries: def.beneficiaries,
      keywords: def.keywords,
      expectedOutcomes: def.expectedOutcomes,
      cover: def.cover,
      collegeId: col._id,
      departmentId: dept._id,
      academicYearId: ay._id,
      academicYearLabel: ay.label,
      partnerCollegeIds: (def.partnerCKeys || []).map((k) => colleges[k]._id),
      partnerDepartmentIds: (def.partnerDKeys || []).map((k) => departments[k]._id),
      status: def.status,
      history,
      team: {
        leaderId: leaderUser._id,
        members: memberUsers.map((m, idx) => ({
          userId: m._id,
          role: idx === 0 ? TEAM_MEMBER_ROLES.LEADER : TEAM_MEMBER_ROLES.MEMBER,
          status: 'active',
          joinedAt: daysAgo(baseAgo + 5),
        })),
      },
      activeMemberIds: memberUsers.map((m) => m._id),
      preferredSupervisorId: preferredSupUser?._id || null,
      supervision: {
        primaryId: primarySupUser?._id || null,
        coSupervisorIds: coSupUsers.map((u) => u._id),
        mentorIds: mentorUsers.map((u) => u._id),
        reviewerId: reviewerSupUser?._id || null,
      },
      ideaId: def.ideaKey ? ideas[def.ideaKey]._id : null,
      statusFlag: def.statusFlag,
      defenseState: def.defenseState,
      ...(signedOff ? { supervisorSignOff: signedOff } : {}),
      budgetEstimate: totalBudget,
      isPublished: Boolean(def.isPublished),
    });

    await backdateCreatedAt(Project, project._id, daysAgo(baseAgo + 6));
    projects[def.key] = project;

    if (def.ideaKey) {
      await Idea.updateOne({ _id: ideas[def.ideaKey]._id }, { $set: { takenByProjectId: project._id } });
    }

    // Proposal versions
    await ProposalVersion.create({
      projectId: project._id,
      version: 1,
      snapshot: buildSnapshot(project),
      authorId: leaderUser._id,
    });
    if ([PROPOSAL_STATUSES.SUPERVISOR_RECOMMENDED, PROPOSAL_STATUSES.APPROVED, PROPOSAL_STATUSES.ARCHIVED].includes(def.status)) {
      await ProposalVersion.create({
        projectId: project._id,
        version: 2,
        snapshot: {
          ...buildSnapshot(project),
          scope: `${project.scope} (محدّث بعد ملاحظات المراجعة الأولية)`,
        },
        authorId: leaderUser._id,
      });
    }

    // ProjectMemberships (active for current year, inactive for archived year)
    for (const m of memberUsers) {
      await ProjectMembership.create({
        userId: m._id,
        academicYearId: ay._id,
        projectId: project._id,
        active: def.yearSlot === 'curr',
      });
    }

    // SupervisorAssignments
    if (primarySupUser) {
      await SupervisorAssignment.create({
        projectId: project._id,
        academicYearId: ay._id,
        collegeId: col._id,
        supervisorId: primarySupUser._id,
        kind: SUPERVISION_KINDS.PRIMARY,
        assignedBy: collegeAdminUser._id,
        startedAt: daysAgo(baseAgo - 8),
        endedAt: def.yearSlot === 'prev' ? daysAgo(90) : null,
      });
    }
    for (const co of coSupUsers) {
      await SupervisorAssignment.create({
        projectId: project._id,
        academicYearId: ay._id,
        collegeId: col._id,
        supervisorId: co._id,
        kind: SUPERVISION_KINDS.CO,
        assignedBy: collegeAdminUser._id,
        startedAt: daysAgo(baseAgo - 7),
        endedAt: def.yearSlot === 'prev' ? daysAgo(90) : null,
      });
    }
    for (const mn of mentorUsers) {
      await SupervisorAssignment.create({
        projectId: project._id,
        academicYearId: ay._id,
        collegeId: col._id,
        supervisorId: mn._id,
        kind: SUPERVISION_KINDS.MENTOR,
        assignedBy: collegeAdminUser._id,
        startedAt: daysAgo(baseAgo - 6),
        endedAt: def.yearSlot === 'prev' ? daysAgo(90) : null,
      });
    }

    // BOM items & Tool items
    for (const [item, quantity, specs, unitPrice, supplier, bomStatus] of def.bom || []) {
      await BOMItem.create({
        projectId: project._id,
        collegeId: col._id,
        academicYearId: ay._id,
        academicYearLabel: ay.label,
        item,
        quantity,
        specs,
        unitPrice,
        currency: 'EGP',
        supplier,
        status: bomStatus,
      });
    }
    for (const [category, name, version, notes] of def.tools || []) {
      await ToolItem.create({
        projectId: project._id,
        collegeId: col._id,
        academicYearId: ay._id,
        academicYearLabel: ay.label,
        category,
        name,
        version,
        notes,
      });
    }

    // Timeline events (proposal lifecycle)
    await TimelineEvent.create({
      projectId: project._id,
      type: 'proposal_created',
      actorId: leaderUser._id,
      refType: 'project',
      refId: project._id,
      summaryKey: 'timeline.proposalCreated',
      data: { title: project.title },
      at: daysAgo(baseAgo + 6),
    });
    if (def.status !== PROPOSAL_STATUSES.DRAFT) {
      await TimelineEvent.create({
        projectId: project._id,
        type: 'proposal_submitted',
        actorId: leaderUser._id,
        refType: 'project',
        refId: project._id,
        summaryKey: 'timeline.proposalSubmitted',
        data: { title: project.title },
        at: daysAgo(baseAgo),
      });
    }
    if ([PROPOSAL_STATUSES.APPROVED, PROPOSAL_STATUSES.ARCHIVED].includes(def.status)) {
      await TimelineEvent.create({
        projectId: project._id,
        type: 'proposal_approved',
        actorId: collegeAdminUser._id,
        refType: 'project',
        refId: project._id,
        summaryKey: 'timeline.proposalApproved',
        data: { title: project.title },
        at: daysAgo(baseAgo - 8),
      });
    }

    // Phases, Deliverables, Submissions, Tasks, Meetings for approved/archived projects
    if (def.phaseMode !== 'none') {
      const tpl = templates[def.cKey];
      const createdPhases = [];
      const createdDeliverables = [];
      const createdSubmissions = [];

      const phaseStatusesByMode = {
        all_approved: [
          DELIVERABLE_STATUSES.APPROVED,
          DELIVERABLE_STATUSES.APPROVED,
          DELIVERABLE_STATUSES.APPROVED,
          DELIVERABLE_STATUSES.APPROVED,
        ],
        three_done_one_review: [
          DELIVERABLE_STATUSES.APPROVED,
          DELIVERABLE_STATUSES.APPROVED,
          DELIVERABLE_STATUSES.APPROVED,
          DELIVERABLE_STATUSES.SUBMITTED,
        ],
        three_done_late: [
          DELIVERABLE_STATUSES.APPROVED,
          DELIVERABLE_STATUSES.APPROVED,
          DELIVERABLE_STATUSES.APPROVED,
          DELIVERABLE_STATUSES.NONE,
        ],
        two_done_changes_req: [
          DELIVERABLE_STATUSES.APPROVED,
          DELIVERABLE_STATUSES.APPROVED,
          DELIVERABLE_STATUSES.CHANGES_REQUESTED,
          DELIVERABLE_STATUSES.NONE,
        ],
        one_done_delayed: [
          DELIVERABLE_STATUSES.APPROVED,
          DELIVERABLE_STATUSES.CHANGES_REQUESTED,
          DELIVERABLE_STATUSES.NONE,
          DELIVERABLE_STATUSES.NONE,
        ],
      };
      const statusPlan = phaseStatusesByMode[def.phaseMode];

      for (let i = 0; i < tpl.phases.length; i += 1) {
        const pDef = tpl.phases[i];
        const targetStatus = statusPlan[i];
        const dueDate =
          def.yearSlot === 'prev'
            ? daysAgo(260 - i * 35)
            : i <= 1
              ? daysAgo(45 - i * 20)
              : i === 2
                ? daysFromNow(def.phaseMode === 'one_done_delayed' ? -10 : 12)
                : daysFromNow(45);

        const phase = await ProjectPhase.create({
          projectId: project._id,
          collegeId: col._id,
          departmentId: dept._id,
          academicYearId: ay._id,
          templateId: tpl._id,
          key: pDef.key,
          name: pDef.name,
          order: pDef.order,
          weight: pDef.weight,
          dueDate,
          forms: pDef.forms || [],
          requiredCount: (pDef.requiredDeliverables || []).length,
          milestones: [
            {
              title: `مراجعة مبدئية — ${pDef.name}`,
              dueDate: new Date(dueDate.getTime() - 7 * 24 * 60 * 60 * 1000),
              done: targetStatus === DELIVERABLE_STATUSES.APPROVED,
              doneAt: targetStatus === DELIVERABLE_STATUSES.APPROVED ? daysAgo(25 - i * 3) : null,
            },
            {
              title: `التسليم النهائي — ${pDef.name}`,
              dueDate,
              done: targetStatus === DELIVERABLE_STATUSES.APPROVED,
              doneAt: targetStatus === DELIVERABLE_STATUSES.APPROVED ? daysAgo(20 - i * 3) : null,
            },
          ],
        });

        const phaseDeliverables = [];
        for (let j = 0; j < pDef.requiredDeliverables.length; j += 1) {
          const dDef = pDef.requiredDeliverables[j];
          // For 3-done-1-review, make 1st deliverable of phase 4 approved & 2nd submitted (so progress is 90%)
          let delStatus = targetStatus;
          if (def.phaseMode === 'three_done_one_review' && i === 3 && j === 0) {
            delStatus = DELIVERABLE_STATUSES.APPROVED;
          }
          const del = await Deliverable.create({
            projectId: project._id,
            phaseId: phase._id,
            collegeId: col._id,
            departmentId: dept._id,
            academicYearId: ay._id,
            key: dDef.key,
            title: dDef.title,
            description: dDef.description,
            allowedTypes: dDef.allowedTypes,
            required: true,
            dueDate,
            latestStatus: delStatus,
          });

          if (delStatus !== DELIVERABLE_STATUSES.NONE && primarySupUser) {
            const isLate =
              (def.phaseMode === 'three_done_late' && i === 2) ||
              (def.phaseMode === 'two_done_changes_req' && i === 2) ||
              (def.phaseMode === 'one_done_delayed' && i === 1);

            const submittedAt = isLate
              ? new Date(dueDate.getTime() + 3 * 24 * 60 * 60 * 1000)
              : new Date(Math.min(Date.now() - 2 * 24 * 60 * 60 * 1000, dueDate.getTime() - 2 * 24 * 60 * 60 * 1000));

            const reviewObj =
              delStatus === DELIVERABLE_STATUSES.APPROVED
                ? {
                    decision: SUBMISSION_DECISIONS.APPROVED,
                    comment: 'عمل ممتاز ومطابق للمعايير الأكاديمية المطلوبة. تم الاعتماد.',
                    reviewerId: primarySupUser._id,
                    at: new Date(submittedAt.getTime() + 24 * 60 * 60 * 1000),
                  }
                : delStatus === DELIVERABLE_STATUSES.CHANGES_REQUESTED
                  ? {
                      decision: SUBMISSION_DECISIONS.CHANGES_REQUESTED,
                      comment: 'يرجى استكمال نتائج الاختبار الميداني وإضافة مقارنة الأداء ثم إعادة الرفع.',
                      reviewerId: primarySupUser._id,
                      at: new Date(submittedAt.getTime() + 18 * 60 * 60 * 1000),
                    }
                  : null;

            // Create v1 (changes_requested) + v2 (approved) on phase 2 for realism on flagship projects
            if (i === 1 && j === 0 && delStatus === DELIVERABLE_STATUSES.APPROVED) {
              const v1 = await Submission.create({
                deliverableId: del._id,
                projectId: project._id,
                collegeId: col._id,
                academicYearId: ay._id,
                academicYearLabel: ay.label,
                version: 1,
                isLatest: false,
                files: [makeDocRef(`${def.key}-p${i}-v1`, `${dDef.key}-v1.pdf`, 'pdf', 640200)],
                links: [
                  { kind: LINK_KINDS.GITHUB, url: `https://github.com/mnu-projects/${def.slug}`, title: 'مستودع المشروع على GitHub' },
                ],
                note: 'الإصدار الأول للمراجعة الأولية مع المشرف.',
                submittedBy: leaderUser._id,
                submittedAt: new Date(submittedAt.getTime() - 6 * 24 * 60 * 60 * 1000),
                isLate: false,
                review: {
                  decision: SUBMISSION_DECISIONS.CHANGES_REQUESTED,
                  comment: 'مخطط البنية جيد، يرجى إضافة مخطط تسلسل العمليات Sequence Diagram وتوضيح معالجة الأخطاء.',
                  reviewerId: primarySupUser._id,
                  at: new Date(submittedAt.getTime() - 4 * 24 * 60 * 60 * 1000),
                },
                reviewHistory: [
                  {
                    decision: SUBMISSION_DECISIONS.CHANGES_REQUESTED,
                    comment: 'مخطط البنية جيد، يرجى إضافة مخطط تسلسل العمليات Sequence Diagram وتوضيح معالجة الأخطاء.',
                    reviewerId: primarySupUser._id,
                    at: new Date(submittedAt.getTime() - 4 * 24 * 60 * 60 * 1000),
                  },
                ],
              });
              createdSubmissions.push(v1);
            }

            const versionNum = i === 1 && j === 0 && delStatus === DELIVERABLE_STATUSES.APPROVED ? 2 : 1;
            const sub = await Submission.create({
              deliverableId: del._id,
              projectId: project._id,
              collegeId: col._id,
              academicYearId: ay._id,
              academicYearLabel: ay.label,
              version: versionNum,
              isLatest: true,
              files: [makeDocRef(`${def.key}-p${i}-d${j}-v${versionNum}`, `${dDef.key}-v${versionNum}.pdf`, 'pdf', 980400)],
              links: [
                { kind: LINK_KINDS.GITHUB, url: `https://github.com/mnu-projects/${def.slug}`, title: 'الكود المصدري — GitHub' },
                ...(i >= 2
                  ? [{ kind: LINK_KINDS.YOUTUBE, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'فيديو العرض التجريبي' }]
                  : []),
              ],
              note: versionNum > 1 ? 'تم استيفاء جميع ملاحظات المشرف وإضافة المخططات المطلوبة.' : 'تم تسليم المخرج المطلوب في الموعد المحدد.',
              submittedBy: memberUsers[j % memberUsers.length]._id,
              submittedAt,
              isLate,
              review: reviewObj,
              reviewHistory: reviewObj ? [reviewObj] : [],
            });
            createdSubmissions.push(sub);

            del.latestSubmissionId = sub._id;
            await del.save();

            await TimelineEvent.create({
              projectId: project._id,
              type: 'submission_uploaded',
              actorId: memberUsers[j % memberUsers.length]._id,
              refType: 'submission',
              refId: sub._id,
              summaryKey: 'timeline.submissionUploaded',
              data: { title: del.title, version: versionNum },
              at: submittedAt,
            });
            if (reviewObj) {
              await TimelineEvent.create({
                projectId: project._id,
                type: 'submission_reviewed',
                actorId: primarySupUser._id,
                refType: 'submission',
                refId: sub._id,
                summaryKey: 'timeline.submissionReviewed',
                data: { title: del.title, decision: reviewObj.decision },
                at: reviewObj.at,
              });
            }
          }

          phaseDeliverables.push(del);
          createdDeliverables.push(del);
        }

        createdPhases.push({ ...phase.toObject(), deliverables: phaseDeliverables });
      }

      // Compute mathematically exact progress using shared calc!
      const computed = computeProgress(createdPhases);
      project.progress = {
        percent: computed.percent,
        perPhase: computed.perPhase,
        computedAt: new Date(),
      };
      await project.save();

      // Kanban Tasks (6 tasks spread across all 4 columns)
      const taskSpecs = [
        ['توثيق الدراسة المرجعية وتحليل الأنظمة المماثلة', 'مقارنة 5 حلول عالمية وتحديد فجوة الابتكار للمشروع.', TASK_COLUMNS.DONE, 'a0', 0],
        ['تصميم معمارية النظام وقاعدة البيانات', 'إعداد مخططات ERD وواجهات التكامل البرمجي.', TASK_COLUMNS.DONE, 'a1', 1],
        ['تطوير الوحدة الأساسية وبناء النموذج الأولي', 'تنفيذ الخوارزمية الأساسية وربطها بواجهة المستخدم.', def.phaseMode === 'all_approved' ? TASK_COLUMNS.DONE : TASK_COLUMNS.IN_PROGRESS, 'a2', 0],
        ['إجراء اختبارات الأداء والتحقق الميداني', 'جمع قياسات الدقة وتقارير الاستجابة على بيانات حقيقية.', def.phaseMode === 'all_approved' ? TASK_COLUMNS.DONE : TASK_COLUMNS.REVIEW, 'a3', 1],
        ['تجهيز الملصق العلمي (Poster) وعرض المناقشة', 'تصميم الشرائح النهائية بهوية جامعة المنصورة الأهلية.', def.phaseMode === 'all_approved' ? TASK_COLUMNS.DONE : TASK_COLUMNS.TODO, 'a4', 0],
        ['تحديث صفحة المعرض العام وإضافة فيديو العرض', 'مراجعة النصوص والصور قبل النشر في معرض الكلية.', def.isPublished ? TASK_COLUMNS.DONE : TASK_COLUMNS.TODO, 'a5', 1],
      ];

      const createdTasks = [];
      for (const [title, description, column, order, assigneeIdx] of taskSpecs) {
        const assignee = memberUsers[assigneeIdx % memberUsers.length];
        const task = await Task.create({
          projectId: project._id,
          title,
          description,
          column,
          order,
          assigneeIds: [assignee._id],
          dueDate: column === TASK_COLUMNS.DONE ? daysAgo(15) : daysFromNow(10),
          createdBy: leaderUser._id,
        });
        createdTasks.push(task);
      }

      // Supervision Meetings (2 realistic meetings with action items linked to tasks)
      const attendees = [...memberUsers.map((m) => m._id), ...(primarySupUser ? [primarySupUser._id] : [])];
      const meeting1 = await Meeting.create({
        projectId: project._id,
        date: daysAgo(def.yearSlot === 'prev' ? 210 : 24),
        attendeeIds: attendees,
        notes: 'مراجعة تقدم التصميم المعماري ومناقشة التحديات الفنية في التكامل. تم الاتفاق على معايير قياس الأداء وجدول الاختبارات التجريبية.',
        actionItems: [
          {
            text: 'استكمال اختبارات الأداء وتوثيق النتائج في التقرير المرحلي',
            assigneeId: memberUsers[0]._id,
            taskId: createdTasks[3]._id,
          },
          {
            text: 'مراجعة قائمة المكونات والميزانية التقديرية مع المشرف',
            assigneeId: memberUsers[Math.min(1, memberUsers.length - 1)]._id,
            taskId: null,
          },
        ],
        createdBy: (primarySupUser || leaderUser)._id,
      });

      const meeting2 = await Meeting.create({
        projectId: project._id,
        date: daysAgo(def.yearSlot === 'prev' ? 165 : 7),
        attendeeIds: attendees,
        notes: 'استعراض النموذج الأولي وتقييم جاهزية المخرجات قبل مرحلة المناقشة. أوصى المشرف بإعداد فيديو توضيحي قصير وعرض تقديمي واضح للمعرض.',
        actionItems: [
          {
            text: 'تجهيز العرض التقديمي والملصق العلمي للمناقشة النهائية',
            assigneeId: memberUsers[0]._id,
            taskId: createdTasks[4]._id,
          },
        ],
        createdBy: (primarySupUser || leaderUser)._id,
      });

      await TimelineEvent.create({
        projectId: project._id,
        type: 'meeting_logged',
        actorId: (primarySupUser || leaderUser)._id,
        refType: 'meeting',
        refId: meeting2._id,
        summaryKey: 'timeline.meetingLogged',
        data: { date: meeting2.date.toISOString() },
        at: meeting2.date,
      });

      trackingMap[def.key] = {
        phases: createdPhases,
        deliverables: createdDeliverables,
        submissions: createdSubmissions,
        tasks: createdTasks,
        meetings: [meeting1, meeting2],
      };
    }
  }

  // 3. Seed Adoption Requests (pending, accepted, declined)
  await AdoptionRequest.create([
    {
      ideaId: ideas.ideaRetina._id,
      requestedBy: users.stSara._id,
      projectId: projects.retinaAi._id,
      status: ADOPTION_REQUEST_STATUSES.ACCEPTED,
      decidedAt: daysAgo(90),
      decidedBy: users.supTarek._id,
    },
    {
      ideaId: ideas.ideaSmartCampus._id,
      requestedBy: users.stFreeEng2._id,
      status: ADOPTION_REQUEST_STATUSES.PENDING,
    },
    {
      ideaId: ideas.ideaExportB2b._id,
      requestedBy: users.stFreeBus1._id,
      status: ADOPTION_REQUEST_STATUSES.PENDING,
    },
    {
      ideaId: ideas.ideaWearableEcg._id,
      requestedBy: users.stFreeEng1._id,
      status: ADOPTION_REQUEST_STATUSES.DECLINED,
      decidedAt: daysAgo(12),
      decidedBy: users.invNileMed._id,
    },
  ]);

  // 4. Seed Team Invitations (pending direct invite, pending link invite, accepted invite)
  await TeamInvitation.create([
    {
      projectId: projects.hospCyber._id,
      collegeId: colleges.eng._id,
      inviteeId: users.stFreeEng1._id,
      isLink: false,
      invitedBy: users.stMoaz._id,
      status: TEAM_INVITATION_STATUSES.PENDING,
      expiresAt: daysFromNow(7),
    },
    {
      projectId: projects.pharmaDraft._id,
      collegeId: colleges.phm._id,
      inviteeId: null,
      isLink: true,
      tokenHash: sha256('mnu-demo-team-invite-pharma-draft'),
      invitedBy: users.stDaliaP._id,
      status: TEAM_INVITATION_STATUSES.PENDING,
      expiresAt: daysFromNow(10),
    },
    {
      projectId: projects.retinaAi._id,
      collegeId: colleges.eng._id,
      inviteeId: users.stYoussef._id,
      isLink: false,
      invitedBy: users.stSara._id,
      status: TEAM_INVITATION_STATUSES.ACCEPTED,
      expiresAt: daysAgo(70),
      respondedAt: daysAgo(88),
      respondedBy: users.stYoussef._id,
    },
  ]);

  // 5. Seed Leadership Transfer (1 pending for demo + 1 accepted history)
  await LeadershipTransfer.create([
    {
      projectId: projects.greenCampus._id,
      fromUserId: users.stFarah._id,
      toUserId: users.stAdham._id,
      initiatedBy: users.stFarah._id,
      status: TRANSFER_STATUSES.PENDING,
    },
    {
      projectId: projects.solarGrid._id,
      fromUserId: users.stAhmedS._id,
      toUserId: users.stMazen._id,
      initiatedBy: users.stAhmedS._id,
      status: TRANSFER_STATUSES.ACCEPTED,
      respondedAt: daysAgo(50),
    },
  ]);

  return { ideas, projects, trackingMap };
}

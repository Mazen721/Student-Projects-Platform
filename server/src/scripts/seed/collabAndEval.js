import {
  CHANNEL_KINDS,
  DEFENSE_STATES,
  LINK_KINDS,
  MEDIA_KINDS,
  MEDIA_VISIBILITY,
  MODIFICATION_STATES,
  REEVALUATION_STATUSES,
  SCOPE_TYPES,
} from '@spp/shared/constants';
import {
  computeEvaluatorTotal,
  computePerCriterionBreakdown,
  computeStudentFinal,
  computeTeamGrade,
  gradeBand,
} from '@spp/shared/calc';
import { normalizeArabic } from '@spp/shared/text';
import Announcement from '../../modules/collaboration/announcement.model.js';
import Channel from '../../modules/collaboration/channel.model.js';
import Comment from '../../modules/collaboration/comment.model.js';
import MediaAlbum from '../../modules/collaboration/mediaAlbum.model.js';
import MediaItem from '../../modules/collaboration/mediaItem.model.js';
import Message from '../../modules/collaboration/message.model.js';
import Committee from '../../modules/evaluation/committee.model.js';
import Defense from '../../modules/evaluation/defense.model.js';
import ExaminerScore from '../../modules/evaluation/examinerScore.model.js';
import Grade from '../../modules/evaluation/grade.model.js';
import ReEvaluationRequest from '../../modules/evaluation/reevaluationRequest.model.js';
import TimelineEvent from '../../modules/tracking/timelineEvent.model.js';
import {
  SEED_IMAGES,
  daysAgo,
  daysFromNow,
  makeDocRef,
  makeImageRef,
} from './helpers.js';

function buildScoreTotals(rubric, teamScores, individualScores, studentIds) {
  const totals = {};
  for (const sid of studentIds) {
    totals[String(sid)] = computeEvaluatorTotal({
      rubric,
      teamScores,
      individualScores,
      studentId: sid,
    });
  }
  return totals;
}

export async function seedCollabAndEval(ctx) {
  const { colleges, departments, rubrics, users, projects, trackingMap } = ctx;

  // 1. Announcements across all 4 scopes (university, college, department, supervision)
  await Announcement.create([
    {
      authorId: users.uniAdmin._id,
      scopeType: SCOPE_TYPES.UNIVERSITY,
      scopeId: null,
      title: 'انطلاق معرض الابتكار ومسابقة أفضل مشروع تخرج بجامعة المنصورة الأهلية 2026/2027',
      body: 'تعلن إدارة جامعة المنصورة الأهلية عن فتح باب التصويت العام وتلقي طلبات النشر في معرض مشاريع التخرج للعام الأكاديمي 2026/2027. تُمنح جوائز مالية وشهادات تميز لأفضل ثلاثة مشاريع على مستوى الجامعة، مع إتاحة فرص احتضان وتمويل بالتعاون مع الشركاء الصناعيين في منطقة الدلتا.',
      audienceCount: 48,
      createdAt: daysAgo(6),
    },
    {
      authorId: users.engAdmin._id,
      scopeType: SCOPE_TYPES.COLLEGE,
      scopeId: colleges.eng._id,
      title: 'تعليمات جدول المناقشات النهائية وتسليم الملصق العلمي — كلية الهندسة',
      body: 'يرجى من جميع فرق السنة النهائية بكلية الهندسة التأكد من اعتماد كافة المراحل قبل موعد المناقشة بأسبوعين على الأقل، والالتزام بقالب الملصق العلمي (A1 Poster) المعتمد بهوية جامعة المنصورة الأهلية وتجهيز عرض عملي للنموذج الأولي.',
      audienceCount: 24,
      createdAt: daysAgo(4),
    },
    {
      authorId: users.busAdmin._id,
      scopeType: SCOPE_TYPES.COLLEGE,
      scopeId: colleges.bus._id,
      title: 'ورشة عمل: إعداد دراسات الجدوى وعرض المشاريع أمام المستثمرين',
      body: 'تنظم كلية الاقتصاد والعلوم الإدارية بالتعاون مع دلتا فنتشرز ورشة عمل تطبيقية حول إعداد خطط العمل وعروض المستثمرين (Pitch Deck) يوم الثلاثاء القادم بقاعة المؤتمرات بالمبنى الإداري.',
      audienceCount: 11,
      createdAt: daysAgo(3),
    },
    {
      authorId: users.phmAdmin._id,
      scopeType: SCOPE_TYPES.COLLEGE,
      scopeId: colleges.phm._id,
      title: 'ضوابط النشر العلمي وأخلاقيات البحث السريري لمشاريع التخرج — كلية الصيدلة',
      body: 'تؤكد لجنة البحوث بكلية الصيدلة ضرورة توثيق المراجع الدوائية المعتمدة والحصول على موافقة لجنة الأخلاقيات قبل جمع أي استبيانات أو بيانات سريرية.',
      audienceCount: 8,
      createdAt: daysAgo(8),
    },
    {
      authorId: users.supTarek._id,
      scopeType: SCOPE_TYPES.DEPARTMENT,
      scopeId: departments.aie._id,
      title: 'إتاحة خوادم التدريب الرسومية بمعمل الذكاء الاصطناعي لفرق القسم',
      body: 'يمكن لفرق قسم هندسة الذكاء الاصطناعي حجز حصص التدريب على خوادم GPU بالمعمل الذكي عبر منسق القسم بعد اعتماد وثيقة التصميم المعماري.',
      audienceCount: 7,
      createdAt: daysAgo(5),
    },
    {
      authorId: users.supTarek._id,
      scopeType: 'supervision',
      scopeId: users.supTarek._id,
      title: 'تذكير باجتماع المتابعة الأسبوعي للفرق تحت إشرافي',
      body: 'موعد المتابعة الأسبوعية يوم الأربعاء الساعة 11:00 صباحاً بمكتب 204 — مبنى الهندسة. يرجى تحديث لوحة المهام ورفع آخر تعديلات المخرجات قبل الاجتماع بـ 24 ساعة.',
      audienceCount: 7,
      createdAt: daysAgo(2),
    },
  ]);

  // 2. Channels & Messages (Project Group, Team Only, and Direct Messages)
  const chatProjectKeys = ['retinaAi', 'robotArm', 'solarGrid', 'finHub', 'pharmaAi', 'agriDrone', 'greenCampus', 'icuMonitor'];
  const channels = {};

  for (const key of chatProjectKeys) {
    const proj = projects[key];
    const teamIds = proj.activeMemberIds || [];
    const supIds = proj.supervisorIds || [];
    const groupIds = Array.from(new Set([...teamIds.map(String), ...supIds.map(String)]));
    const leaderId = proj.team.leaderId;
    const secondMemberId = teamIds[1] || leaderId;
    const primarySupId = proj.supervision.primaryId;

    const groupChannel = await Channel.create({
      projectId: proj._id,
      kind: CHANNEL_KINDS.PROJECT_GROUP,
      memberIds: groupIds,
      members: groupIds.map((uid) => ({ userId: uid, lastReadAt: daysAgo(1) })),
      title: `محادثة المشروع — ${proj.title}`,
      collegeId: proj.collegeId,
      departmentId: proj.departmentId,
      academicYearId: proj.academicYearId,
    });
    channels[`${key}_group`] = groupChannel;

    const m1 = await Message.create({
      channelId: groupChannel._id,
      senderId: leaderId,
      text: 'السلام عليكم دكتور، تم رفع أحدث نسخة من التقرير المرحلي وتحديث الكود المصدري على GitHub للمراجعة.',
      textNormalized: normalizeArabic('السلام عليكم دكتور، تم رفع أحدث نسخة من التقرير المرحلي وتحديث الكود المصدري على GitHub للمراجعة.'),
      attachments: [makeDocRef(`chat-${key}-1`, 'ملخص-التقدم-الأسبوعي.pdf', 'pdf', 310200)],
      readBy: groupIds.map((uid) => ({ userId: uid, at: daysAgo(2) })),
      createdAt: daysAgo(3, 4),
    });

    const m2 = await Message.create({
      channelId: groupChannel._id,
      senderId: primarySupId,
      text: 'أحسنت يا فريق! راجعت النتائج وهي مبشرة جداً. برجاء التركيز على مقارنة الأداء مع الدراسات المرجعية وإضافة رسوم توضيحية واضحة في العرض.',
      textNormalized: normalizeArabic('أحسنت يا فريق! راجعت النتائج وهي مبشرة جداً. برجاء التركيز على مقارنة الأداء مع الدراسات المرجعية وإضافة رسوم توضيحية واضحة في العرض.'),
      replyToId: m1._id,
      mentions: [leaderId],
      readBy: teamIds.map((uid) => ({ userId: uid, at: daysAgo(1) })),
      createdAt: daysAgo(2, 18),
    });

    await Message.create({
      channelId: groupChannel._id,
      senderId: secondMemberId,
      text: 'تمام يا دكتور، جارٍ تجهيز الرسوم البيانية وسنستعرضها في اجتماع المتابعة القادم بإذن الله.',
      textNormalized: normalizeArabic('تمام يا دكتور، جارٍ تجهيز الرسوم البيانية وسنستعرضها في اجتماع المتابعة القادم بإذن الله.'),
      replyToId: m2._id,
      readBy: [{ userId: leaderId, at: daysAgo(1) }],
      createdAt: daysAgo(1, 5),
    });

    // Team-only channel
    const teamChannel = await Channel.create({
      projectId: proj._id,
      kind: CHANNEL_KINDS.TEAM_ONLY,
      memberIds: teamIds,
      members: teamIds.map((uid) => ({ userId: uid, lastReadAt: daysAgo(1) })),
      title: `فريق العمل فقط — ${proj.title}`,
      collegeId: proj.collegeId,
      departmentId: proj.departmentId,
      academicYearId: proj.academicYearId,
    });
    channels[`${key}_team`] = teamChannel;

    await Message.create([
      {
        channelId: teamChannel._id,
        senderId: leaderId,
        text: 'يا شباب نراجع مهام لوحة الـ Kanban النهارده علشان نقفل كل المتبقي قبل موعد التسليم.',
        textNormalized: normalizeArabic('يا شباب نراجع مهام لوحة الـ Kanban النهارده علشان نقفل كل المتبقي قبل موعد التسليم.'),
        readBy: teamIds.map((uid) => ({ userId: uid, at: daysAgo(1) })),
        createdAt: daysAgo(2, 6),
      },
      {
        channelId: teamChannel._id,
        senderId: secondMemberId,
        text: 'أنا خلصت جزء الاختبارات ورفعته على الفرع الرئيسي، تقدروا تراجعوه وتجهزوا عرض المناقشة.',
        textNormalized: normalizeArabic('أنا خلصت جزء الاختبارات ورفعته على الفرع الرئيسي، تقدروا تراجعوه وتجهزوا عرض المناقشة.'),
        readBy: [{ userId: leaderId, at: daysAgo(1) }],
        createdAt: daysAgo(1, 3),
      },
    ]);
  }

  // Direct Channels (3 realistic 1-on-1 conversations)
  const dmPairs = [
    [
      users.supTarek._id,
      users.stSara._id,
      'سارة، ممتازة جداً نتائج دقة نموذج شبكية العين بعد التحديث الأخير (95.4%). سأرشح المشروع للعرض المميز في معرض الجامعة.',
      'شكراً جزيلاً لحضرتك يا دكتور طارق! ده بفضل توجيهات حضرتك ود. سلوى المستمرة، وهنجهز الفيديو التعريفي للمعرض.',
    ],
    [
      users.engAdmin._id,
      users.supTarek._id,
      'د. طارق، هل لجان مناقشة قسم الذكاء الاصطناعي جاهزة ومؤكدة مع الممتحنين الخارجيين؟',
      'نعم معالي العميد، تم التنسيق مع أ.د. محمود أبو النجا وم. سامح قنديل وجدول المناقشات جاهز على المنصة.',
    ],
    [
      users.supWalid._id,
      users.stKareemB._id,
      'كريم، م. عمر الجارحي من دلتا فنتشرز أبدى اهتماماً ببوابة MNU FinHub، راجعوا طلبات التواصل على المنصة.',
      'رائع يا دكتور وليد! سنقوم بالرد فوراً وتنسيق جلسة عرض مباشر للمنصة.',
    ],
  ];

  for (const [u1, u2, txt1, txt2] of dmPairs) {
    const dm = await Channel.create({
      projectId: null,
      kind: CHANNEL_KINDS.DIRECT,
      memberIds: [u1, u2],
      members: [
        { userId: u1, lastReadAt: daysAgo(0, 6) },
        { userId: u2, lastReadAt: daysAgo(1) },
      ],
    });
    await Message.create([
      {
        channelId: dm._id,
        senderId: u1,
        text: txt1,
        textNormalized: normalizeArabic(txt1),
        readBy: [{ userId: u1, at: daysAgo(1) }, { userId: u2, at: daysAgo(0, 14) }],
        createdAt: daysAgo(1, 16),
      },
      {
        channelId: dm._id,
        senderId: u2,
        text: txt2,
        textNormalized: normalizeArabic(txt2),
        readBy: [{ userId: u2, at: daysAgo(0, 12) }],
        createdAt: daysAgo(0, 12),
      },
    ]);
  }

  // 3. Internal Comments on Submissions, Deliverables, and Tasks
  for (const key of ['retinaAi', 'robotArm', 'solarGrid', 'finHub', 'agriDrone']) {
    const proj = projects[key];
    const track = trackingMap[key];
    if (!track) continue;

    if (track.submissions[0]) {
      const c1 = await Comment.create({
        targetType: 'submission',
        targetId: track.submissions[0]._id,
        projectId: proj._id,
        authorId: proj.supervision.primaryId,
        text: 'مجهود منظم جداً؛ يُرجى التأكد من ترقيم الأشكال والجداول وفق دليل كتابة الرسائل الجامعية بجامعة المنصورة الأهلية.',
        createdAt: daysAgo(14),
      });
      await Comment.create({
        targetType: 'submission',
        targetId: track.submissions[0]._id,
        projectId: proj._id,
        authorId: proj.team.leaderId,
        parentId: c1._id,
        text: 'تم تعديل الترقيم وتحديث فهرس الأشكال في النسخة المعتمدة، شكراً دكتور.',
        createdAt: daysAgo(13),
      });
    }
    if (track.tasks[2]) {
      await Comment.create({
        targetType: 'task',
        targetId: track.tasks[2]._id,
        projectId: proj._id,
        authorId: proj.team.leaderId,
        text: 'تم دمج وحدة الاختبار الآلي ورفع التغطية إلى 88% — جاهز للمراجعة.',
        createdAt: daysAgo(4),
      });
    }
  }

  // 4. Media Albums & Media Items (Public & Private Photos + Demo Videos)
  const mediaSpecs = [
    {
      key: 'retinaAi',
      albums: [
        {
          title: 'الواجهات ونتائج التشخيص السريري',
          items: [
            { kind: MEDIA_KINDS.PHOTO, img: SEED_IMAGES.retinaAi, caption: 'واجهة فحص صور قاع العين وتوليد الخريطة الحرارية Grad-CAM', vis: MEDIA_VISIBILITY.PUBLIC },
            { kind: MEDIA_KINDS.PHOTO, img: SEED_IMAGES.retinaAi2, caption: 'نتائج دقة التصنيف على عينة اختبار مستشفى المنصورة', vis: MEDIA_VISIBILITY.PUBLIC },
            { kind: MEDIA_KINDS.VIDEO_LINK, url: 'https://www.youtube.com/watch?v=aircAruvnKk', caption: 'فيديو توضيحي لآلية عمل نموذج الذكاء الاصطناعي', vis: MEDIA_VISIBILITY.PUBLIC },
          ],
        },
        {
          title: 'صور العمل المعملي واجتماعات الفريق',
          items: [
            { kind: MEDIA_KINDS.PHOTO, img: SEED_IMAGES.medicalApp, caption: 'جلسة التحقق السريري مع أطباء كلية الطب', vis: MEDIA_VISIBILITY.PRIVATE },
          ],
        },
      ],
    },
    {
      key: 'robotArm',
      albums: [
        {
          title: 'النموذج الأولي والاختبار الميكانيكي',
          items: [
            { kind: MEDIA_KINDS.PHOTO, img: SEED_IMAGES.robotArm, caption: 'الذراع الروبوتية بعد تجميع المحركات وحساسات EMG', vis: MEDIA_VISIBILITY.PUBLIC },
            { kind: MEDIA_KINDS.PHOTO, img: SEED_IMAGES.robotArm2, caption: 'اختبار دقة الاستجابة العضلية بمعمل الهندسة الطبية — MNU', vis: MEDIA_VISIBILITY.PUBLIC },
          ],
        },
      ],
    },
    {
      key: 'solarGrid',
      albums: [
        {
          title: 'منظومة الألواح الشمسية ولوحة SCADA',
          items: [
            { kind: MEDIA_KINDS.PHOTO, img: SEED_IMAGES.solarGrid, caption: 'مصفوفة الألواح الشمسية ونموذج التتبع الذكي', vis: MEDIA_VISIBILITY.PUBLIC },
            { kind: MEDIA_KINDS.PHOTO, img: SEED_IMAGES.solarGrid2, caption: 'لوحة مراقبة الإنتاج والتخزين الفوري للحرم الجامعي', vis: MEDIA_VISIBILITY.PUBLIC },
          ],
        },
      ],
    },
    {
      key: 'finHub',
      albums: [
        {
          title: 'لقطات من بوابة MNU FinHub',
          items: [
            { kind: MEDIA_KINDS.PHOTO, img: SEED_IMAGES.fintech, caption: 'حاسبة التدفقات النقدية ونقطة التعادل لرواد الأعمال', vis: MEDIA_VISIBILITY.PUBLIC },
            { kind: MEDIA_KINDS.PHOTO, img: SEED_IMAGES.fintech2, caption: 'لوحة مقارنة الفرص الاستثمارية بالدلتا', vis: MEDIA_VISIBILITY.PUBLIC },
          ],
        },
      ],
    },
    {
      key: 'medWaste',
      albums: [
        {
          title: 'توثيق النموذج الميداني لإدارة المخلفات الطبية',
          items: [
            { kind: MEDIA_KINDS.PHOTO, img: SEED_IMAGES.medWaste, caption: 'وحدة التتبع الذكية ببطاقات RFID وقياس الوزن', vis: MEDIA_VISIBILITY.PUBLIC },
          ],
        },
      ],
    },
    {
      key: 'waterRobot',
      albums: [
        {
          title: 'اختبار روبوت فحص خطوط المياه',
          items: [
            { kind: MEDIA_KINDS.PHOTO, img: SEED_IMAGES.waterRobot, caption: 'الدائرة الإلكترونية وحساسات الموجات فوق الصوتية', vis: MEDIA_VISIBILITY.PUBLIC },
          ],
        },
      ],
    },
  ];

  for (const spec of mediaSpecs) {
    const proj = projects[spec.key];
    for (let aIdx = 0; aIdx < spec.albums.length; aIdx += 1) {
      const alb = spec.albums[aIdx];
      const albumDoc = await MediaAlbum.create({
        projectId: proj._id,
        title: alb.title,
        order: aIdx + 1,
      });
      for (let iIdx = 0; iIdx < alb.items.length; iIdx += 1) {
        const it = alb.items[iIdx];
        await MediaItem.create({
          albumId: albumDoc._id,
          projectId: proj._id,
          kind: it.kind,
          file:
            it.kind === MEDIA_KINDS.PHOTO
              ? makeImageRef(`media-${spec.key}-${aIdx}-${iIdx}`, it.img, `${spec.key}-${iIdx}.jpg`)
              : null,
          link:
            it.kind === MEDIA_KINDS.VIDEO_LINK
              ? { kind: LINK_KINDS.YOUTUBE, url: it.url, title: it.caption }
              : null,
          caption: it.caption,
          visibility: it.vis,
          createdBy: proj.team.leaderId,
        });
      }
    }
  }

  // 5. Evaluation: Committees, Defenses, ExaminerScores, Locked Grades, ReEvaluationRequests
  const defenses = {};

  async function seedFinalizedDefense({
    projKey,
    rubric,
    chairUser,
    memberUsers,
    externalUsers = [],
    adminUser,
    room,
    scheduledAt,
    finalizedAt,
    minutes,
    recommendations,
    modifications,
    scorePlan, // { supTeam, commTeams: [], indByStudentIdx: [{ sup, comms: [] }] }
    defenseStateOverride = DEFENSE_STATES.FINALIZED,
  }) {
    const proj = projects[projKey];
    const studentIds = proj.activeMemberIds;
    const primarySupId = proj.supervision.primaryId;

    const committee = await Committee.create({
      projectId: proj._id,
      chairId: chairUser._id,
      memberIds: memberUsers.map((u) => u._id),
      externalExaminerIds: externalUsers.map((u) => u._id),
      createdBy: adminUser._id,
    });

    const defense = await Defense.create({
      projectId: proj._id,
      collegeId: proj.collegeId,
      departmentId: proj.departmentId,
      academicYearId: proj.academicYearId,
      academicYearLabel: proj.academicYearLabel,
      rubricId: rubric._id,
      state: defenseStateOverride,
      scheduledAt,
      durationMin: 60,
      room,
      meetingLink: `https://meet.google.com/mnu-${projKey.slice(0, 6)}-def`,
      committeeId: committee._id,
      chairId: chairUser._id,
      examinerIds: committee.allExaminerIds,
      supervisorIds: proj.supervisorIds,
      eligibleMemberIds: studentIds,
      minutes,
      recommendations,
      modifications: modifications || { required: false, state: MODIFICATION_STATES.NONE },
      finalizedAt,
      finalizedBy: chairUser._id,
      history: [
        { from: DEFENSE_STATES.ELIGIBLE, to: DEFENSE_STATES.SCHEDULED, event: 'SCHEDULE', actorId: adminUser._id, actorRole: 'collegeAdmin', at: new Date(scheduledAt.getTime() - 10 * 86400000) },
        { from: DEFENSE_STATES.SCHEDULED, to: DEFENSE_STATES.GRADING, event: 'OPEN_GRADING', actorId: chairUser._id, actorRole: 'committeeMember', at: scheduledAt },
        { from: DEFENSE_STATES.GRADING, to: DEFENSE_STATES.FINALIZED, event: 'FINALIZE', actorId: chairUser._id, actorRole: 'committeeMember', note: 'تم اعتماد الدرجات النهائية بالإجماع.', at: finalizedAt },
      ],
    });
    committee.defenseId = defense._id;
    await committee.save();

    // Build Supervisor ExaminerScore
    const supInd = {};
    studentIds.forEach((sid, idx) => {
      supInd[String(sid)] = scorePlan.indByStudentIdx[idx].sup;
    });
    const supTotals = buildScoreTotals(rubric, scorePlan.supTeam, supInd, studentIds);
    const supScoreDoc = await ExaminerScore.create({
      defenseId: defense._id,
      projectId: proj._id,
      examinerId: primarySupId,
      component: 'supervisor',
      version: 1,
      teamScores: scorePlan.supTeam,
      individualScores: supInd,
      totals: supTotals,
      submittedAt: new Date(finalizedAt.getTime() - 3600000),
    });

    // Build Committee ExaminerScores
    const commExaminers = committee.allExaminerIds;
    const commScoreDocs = [];
    for (let eIdx = 0; eIdx < commExaminers.length; eIdx += 1) {
      const cTeam = scorePlan.commTeams[eIdx % scorePlan.commTeams.length];
      const cInd = {};
      studentIds.forEach((sid, sIdx) => {
        const arr = scorePlan.indByStudentIdx[sIdx].comms;
        cInd[String(sid)] = arr[eIdx % arr.length];
      });
      const cTotals = buildScoreTotals(rubric, cTeam, cInd, studentIds);
      const doc = await ExaminerScore.create({
        defenseId: defense._id,
        projectId: proj._id,
        examinerId: commExaminers[eIdx],
        component: 'committee',
        version: 1,
        teamScores: cTeam,
        individualScores: cInd,
        totals: cTotals,
        submittedAt: new Date(finalizedAt.getTime() - 1800000),
      });
      commScoreDocs.push(doc);
    }

    // Compute and store mathematically exact Locked Grades per student!
    const teamGrade = computeTeamGrade({
      rubric,
      supervisorTeamScores: supScoreDoc.teamScores,
      committeeTeamScoresList: commScoreDocs.map((d) => d.teamScores),
    });

    const createdGrades = [];
    for (const sid of studentIds) {
      const sidStr = String(sid);
      const studentRes = computeStudentFinal({
        supervisorPct: rubric.supervisorPct,
        committeePct: rubric.committeePct,
        supervisorTotal: supScoreDoc.totals[sidStr],
        committeeTotals: commScoreDocs.map((d) => d.totals[sidStr]),
      });
      const breakdown = computePerCriterionBreakdown({
        rubric,
        supervisorScores: supScoreDoc,
        committeeScoresList: commScoreDocs,
        studentId: sidStr,
      });
      const bandInfo = gradeBand(studentRes.final, 60);

      const gradeDoc = await Grade.create({
        projectId: proj._id,
        studentId: sid,
        defenseId: defense._id,
        collegeId: proj.collegeId,
        departmentId: proj.departmentId,
        academicYearId: proj.academicYearId,
        academicYearLabel: proj.academicYearLabel,
        version: 1,
        isLatest: true,
        supervisorTotal: studentRes.supervisorTotal,
        committeeAvg: studentRes.committeeAvg,
        final: studentRes.final,
        teamGrade,
        perCriterion: breakdown,
        passed: bandInfo.passed,
        band: bandInfo.band,
        locked: true,
        finalizedAt,
        finalizedBy: chairUser._id,
        finalizeNote: 'اعتماد الدرجات النهائية بعد استيفاء كافة معايير التقييم.',
      });
      createdGrades.push(gradeDoc);
    }

    await TimelineEvent.create([
      {
        projectId: proj._id,
        type: 'defense_scheduled',
        actorId: adminUser._id,
        refType: 'defense',
        refId: defense._id,
        summaryKey: 'timeline.defenseScheduled',
        data: { room, scheduledAt: scheduledAt.toISOString() },
        at: new Date(scheduledAt.getTime() - 10 * 86400000),
      },
      {
        projectId: proj._id,
        type: 'grades_finalized',
        actorId: chairUser._id,
        refType: 'defense',
        refId: defense._id,
        summaryKey: 'timeline.gradesFinalized',
        data: { teamGrade },
        at: finalizedAt,
      },
    ]);

    defenses[projKey] = { defense, committee, grades: createdGrades };
    return { defense, committee, grades: createdGrades };
  }

  // Defense 1: Retina AI (2026/2027) — FINALIZED, Excellent!
  await seedFinalizedDefense({
    projKey: 'retinaAi',
    rubric: rubrics.curr.eng,
    chairUser: users.extAbulnaga,
    memberUsers: [users.supHeba, users.supNoha],
    externalUsers: [users.extSameh],
    adminUser: users.engAdmin,
    room: 'مدرج أ.د. محمد غنيم — كلية الهندسة',
    scheduledAt: daysAgo(12),
    finalizedAt: daysAgo(11),
    minutes: 'قدّم الفريق عرضاً عملياً متميزاً لمنصة تشخيص اعتلال الشبكية السكري، وأثبت كفاءة الخرائط التفسيرية Grad-CAM على حالات حقيقية بالتعاون مع كلية الطب.',
    recommendations: 'توصي اللجنة بتسجيل براءة اختراع مبدئية ونشر ورقة علمية في مؤتمر دولي محكّم، وإتاحة المشروع في معرض الجامعة المميز.',
    scorePlan: {
      supTeam: { innovation: 96, technical_depth: 95, documentation: 94 },
      commTeams: [
        { innovation: 95, technical_depth: 94, documentation: 92 },
        { innovation: 94, technical_depth: 92, documentation: 93 },
        { innovation: 96, technical_depth: 95, documentation: 91 },
        { innovation: 93, technical_depth: 93, documentation: 92 },
      ],
      indByStudentIdx: [
        { sup: { presentation: 98, individual_contribution: 97 }, comms: [{ presentation: 96, individual_contribution: 96 }, { presentation: 95, individual_contribution: 94 }] },
        { sup: { presentation: 94, individual_contribution: 95 }, comms: [{ presentation: 93, individual_contribution: 94 }, { presentation: 92, individual_contribution: 92 }] },
        { sup: { presentation: 91, individual_contribution: 92 }, comms: [{ presentation: 90, individual_contribution: 91 }, { presentation: 89, individual_contribution: 90 }] },
        { sup: { presentation: 93, individual_contribution: 94 }, comms: [{ presentation: 92, individual_contribution: 93 }, { presentation: 91, individual_contribution: 92 }] },
      ],
    },
  });

  // Defense 2: Robot Arm (2026/2027) — GRADING in progress (live grading demo!)
  {
    const proj = projects.robotArm;
    const rubric = rubrics.curr.eng;
    const committee = await Committee.create({
      projectId: proj._id,
      chairId: users.supTarek._id,
      memberIds: [users.supHeba._id],
      externalExaminerIds: [users.extSameh._id],
      createdBy: users.engAdmin._id,
    });
    const defense = await Defense.create({
      projectId: proj._id,
      collegeId: proj.collegeId,
      departmentId: proj.departmentId,
      academicYearId: proj.academicYearId,
      academicYearLabel: proj.academicYearLabel,
      rubricId: rubric._id,
      state: DEFENSE_STATES.GRADING,
      scheduledAt: daysAgo(1),
      durationMin: 60,
      room: 'معمل الميكاترونكس والروبوتات — B104',
      committeeId: committee._id,
      chairId: users.supTarek._id,
      examinerIds: committee.allExaminerIds,
      supervisorIds: proj.supervisorIds,
      eligibleMemberIds: proj.activeMemberIds,
      minutes: 'تم عرض النموذج الأولي للذراع الروبوتية واختبار قراءة إشارات EMG بنجاح؛ جارٍ استكمال رصد الدرجات من أعضاء اللجنة.',
      history: [
        { from: DEFENSE_STATES.ELIGIBLE, to: DEFENSE_STATES.SCHEDULED, event: 'SCHEDULE', actorId: users.engAdmin._id, actorRole: 'collegeAdmin', at: daysAgo(9) },
        { from: DEFENSE_STATES.SCHEDULED, to: DEFENSE_STATES.GRADING, event: 'OPEN_GRADING', actorId: users.supTarek._id, actorRole: 'committeeMember', at: daysAgo(1) },
      ],
    });
    committee.defenseId = defense._id;
    await committee.save();

    // Primary supervisor & 1 committee examiner already submitted; Chair (supervisor@mnu.edu.eg) & extSameh still ready to submit live!
    const sIds = proj.activeMemberIds;
    const supTeam = { innovation: 92, technical_depth: 90, documentation: 88 };
    const supInd = Object.fromEntries(sIds.map((id) => [String(id), { presentation: 91, individual_contribution: 90 }]));
    await ExaminerScore.create({
      defenseId: defense._id,
      projectId: proj._id,
      examinerId: proj.supervision.primaryId,
      component: 'supervisor',
      version: 1,
      teamScores: supTeam,
      individualScores: supInd,
      totals: buildScoreTotals(rubric, supTeam, supInd, sIds),
      submittedAt: daysAgo(0, 10),
    });

    const c1Team = { innovation: 89, technical_depth: 87, documentation: 85 };
    const c1Ind = Object.fromEntries(sIds.map((id) => [String(id), { presentation: 88, individual_contribution: 86 }]));
    await ExaminerScore.create({
      defenseId: defense._id,
      projectId: proj._id,
      examinerId: users.supHeba._id,
      component: 'committee',
      version: 1,
      teamScores: c1Team,
      individualScores: c1Ind,
      totals: buildScoreTotals(rubric, c1Team, c1Ind, sIds),
      submittedAt: daysAgo(0, 6),
    });

    defenses.robotArm = { defense, committee, grades: [] };
  }

  // Defense 3: Solar Grid (2026/2027) — SCHEDULED upcoming in 10 days!
  {
    const proj = projects.solarGrid;
    const rubric = rubrics.curr.eng;
    const committee = await Committee.create({
      projectId: proj._id,
      chairId: users.supTarek._id,
      memberIds: [users.supAmr._id],
      externalExaminerIds: [users.extAbulnaga._id],
      createdBy: users.engAdmin._id,
    });
    const defense = await Defense.create({
      projectId: proj._id,
      collegeId: proj.collegeId,
      departmentId: proj.departmentId,
      academicYearId: proj.academicYearId,
      academicYearLabel: proj.academicYearLabel,
      rubricId: rubric._id,
      state: DEFENSE_STATES.SCHEDULED,
      scheduledAt: daysFromNow(10, 2),
      durationMin: 60,
      room: 'قاعة السيمنار الذكية — مبنى الهندسة 301',
      meetingLink: 'https://meet.google.com/mnu-solar-grid-2027',
      committeeId: committee._id,
      chairId: users.supTarek._id,
      examinerIds: committee.allExaminerIds,
      supervisorIds: proj.supervisorIds,
      eligibleMemberIds: proj.activeMemberIds,
      history: [
        { from: DEFENSE_STATES.ELIGIBLE, to: DEFENSE_STATES.SCHEDULED, event: 'SCHEDULE', actorId: users.engAdmin._id, actorRole: 'collegeAdmin', at: daysAgo(2) },
      ],
    });
    committee.defenseId = defense._id;
    await committee.save();
    defenses.solarGrid = { defense, committee, grades: [] };
  }

  // Defense 4: Medical Waste (2025/2026) — FINALIZED, Excellent, Modifications CONFIRMED
  await seedFinalizedDefense({
    projKey: 'medWaste',
    rubric: rubrics.prev.phm,
    chairUser: users.extAbulnaga,
    memberUsers: [users.supSalwa, users.supEman],
    adminUser: users.phmAdmin,
    room: 'مدرج كلية الصيدلة — جامعة المنصورة الأهلية',
    scheduledAt: daysAgo(125),
    finalizedAt: daysAgo(124),
    minutes: 'أشادت اللجنة بالربط المتكامل بين معايير السلامة الدوائية وتقنيات التتبع ببطاقات RFID.',
    recommendations: 'تطبيق التجربة في المعامل المركزية للجامعة خلال العام التالي.',
    modifications: {
      required: true,
      description: 'إضافة فصل تقييم الأثر البيئي وتحديث مخطط توزيع الحاويات.',
      deadline: daysAgo(110),
      state: MODIFICATION_STATES.CONFIRMED,
      confirmedBy: users.supYasser._id,
      confirmedAt: daysAgo(115),
    },
    scorePlan: {
      supTeam: { innovation: 95, technical_depth: 94, documentation: 96 },
      commTeams: [
        { innovation: 94, technical_depth: 93, documentation: 95 },
        { innovation: 93, technical_depth: 92, documentation: 94 },
        { innovation: 95, technical_depth: 94, documentation: 93 },
      ],
      indByStudentIdx: [
        { sup: { presentation: 96, individual_contribution: 95 }, comms: [{ presentation: 95, individual_contribution: 94 }] },
        { sup: { presentation: 92, individual_contribution: 93 }, comms: [{ presentation: 91, individual_contribution: 92 }] },
      ],
    },
  });

  // Defense 5: Water Robot (2025/2026) — FINALIZED, Excellent/Very Good
  await seedFinalizedDefense({
    projKey: 'waterRobot',
    rubric: rubrics.prev.eng,
    chairUser: users.supTarek,
    memberUsers: [users.supNoha],
    externalUsers: [users.extSameh],
    adminUser: users.engAdmin,
    room: 'مدرج أ.د. محمد غنيم — كلية الهندسة',
    scheduledAt: daysAgo(122),
    finalizedAt: daysAgo(121),
    minutes: 'عرض عملي ناجح لاكتشاف تسرب مياه محاكى داخل أنبوب بطول 6 أمتار بدقة عالية.',
    recommendations: 'تحسين عزل الموصلات الكهربائية للعمل تحت ضغط مائي أعلى.',
    scorePlan: {
      supTeam: { innovation: 90, technical_depth: 89, documentation: 87 },
      commTeams: [
        { innovation: 88, technical_depth: 86, documentation: 85 },
        { innovation: 89, technical_depth: 87, documentation: 86 },
        { innovation: 87, technical_depth: 88, documentation: 84 },
      ],
      indByStudentIdx: [
        { sup: { presentation: 91, individual_contribution: 90 }, comms: [{ presentation: 89, individual_contribution: 88 }] },
        { sup: { presentation: 84, individual_contribution: 85 }, comms: [{ presentation: 82, individual_contribution: 83 }] },
      ],
    },
  });

  // Defense 6: Diabetes CDS (2025/2026) — FINALIZED + PENDING ReEvaluationRequest (for Admin Queue!)
  const diabRes = await seedFinalizedDefense({
    projKey: 'diabetesCds',
    rubric: rubrics.prev.med,
    chairUser: users.extAbulnaga,
    memberUsers: [users.supYasser, users.supEman],
    adminUser: users.medAdmin,
    room: 'قاعة المناقشات السريرية — كلية الطب البشري',
    scheduledAt: daysAgo(118),
    finalizedAt: daysAgo(117),
    minutes: 'مشروع بحثي تطبيقي متماسك مع توصية بتوسيع عينة التحقق السريري.',
    recommendations: 'إضافة مقارنة معايير الحساسية والنوعية للتوصيات الدوائية.',
    defenseStateOverride: DEFENSE_STATES.REEVALUATION_REQUESTED,
    scorePlan: {
      supTeam: { innovation: 84, technical_depth: 82, documentation: 80 },
      commTeams: [
        { innovation: 79, technical_depth: 77, documentation: 78 },
        { innovation: 81, technical_depth: 78, documentation: 79 },
        { innovation: 78, technical_depth: 76, documentation: 77 },
      ],
      indByStudentIdx: [
        { sup: { presentation: 83, individual_contribution: 82 }, comms: [{ presentation: 80, individual_contribution: 79 }] },
        { sup: { presentation: 77, individual_contribution: 76 }, comms: [{ presentation: 74, individual_contribution: 75 }] },
      ],
    },
  });

  const reevalPending = await ReEvaluationRequest.create({
    projectId: projects.diabetesCds._id,
    defenseId: diabRes.defense._id,
    collegeId: projects.diabetesCds.collegeId,
    departmentId: projects.diabetesCds.departmentId,
    academicYearId: projects.diabetesCds.academicYearId,
    scope: 'student',
    studentId: users.stPrev6._id,
    requestedBy: users.stPrev6._id,
    requesterRole: 'student',
    reason: 'أرجو مراجعة درجة معيار الإسهام الفردي والتنفيذ الفني حيث قمت ببناء وحدة تحليل بيانات HbA1c وتدريب النموذج الإحصائي بالكامل وتوثيقه في الملحق التقني.',
    status: REEVALUATION_STATUSES.PENDING,
    oldGrades: diabRes.grades.filter((g) => String(g.studentId) === String(users.stPrev6._id)).map((g) => ({ final: g.final, band: g.band })),
  });
  diabRes.defense.activeReevaluationId = reevalPending._id;
  await diabRes.defense.save();

  // Defense 7: Crowdfunding (2025/2026) — FINALIZED with Good & Acceptable grade bands so charts show full distribution!
  await seedFinalizedDefense({
    projKey: 'crowdfund',
    rubric: rubrics.prev.bus,
    chairUser: users.supMona,
    memberUsers: [users.supTarek, users.extAbulnaga],
    adminUser: users.busAdmin,
    room: 'قاعة المناقشات — كلية الاقتصاد والعلوم الإدارية',
    scheduledAt: daysAgo(120),
    finalizedAt: daysAgo(119),
    minutes: 'منصة جيدة لخدمة الحرفيين بالدقهلية؛ تحتاج لاستكمال دراسة الامتثال التنظيمي لبوابات الدفع.',
    recommendations: 'استكمال توثيق خطة الأمان المالي وتسليم النسخة النهائية المنقحة.',
    modifications: {
      required: true,
      description: 'تحديث فصل الامتثال التنظيمي للتمويل الجماعي في مصر وفق ضوابط الهيئة العامة للرقابة المالية.',
      deadline: daysAgo(100),
      state: MODIFICATION_STATES.OVERDUE,
    },
    scorePlan: {
      supTeam: { innovation: 75, technical_depth: 70, documentation: 72 },
      commTeams: [
        { innovation: 72, technical_depth: 68, documentation: 70 },
        { innovation: 70, technical_depth: 66, documentation: 69 },
        { innovation: 71, technical_depth: 67, documentation: 68 },
      ],
      indByStudentIdx: [
        { sup: { presentation: 76, individual_contribution: 74 }, comms: [{ presentation: 73, individual_contribution: 72 }] },
        { sup: { presentation: 65, individual_contribution: 63 }, comms: [{ presentation: 62, individual_contribution: 61 }] },
      ],
    },
  });

  return { channels, defenses };
}

/**
 * Monthly campaign post generator
 * ===============================
 * Turns a month + free-text brief into six dated, multi-channel post drafts.
 * Vertical and focus are inferred from keywords in the brief.
 */

const MONTHS_MAP = {
  "August": { num: 7, days: 31 },
  "September": { num: 8, days: 30 },
  "October": { num: 9, days: 31 }
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Vertical inference — first matching pattern wins.
const VERTICAL_RULES = [
  [/dent(al|ist)/i, { vertical: "dental practices", clientTerm: "patients", workflowIcon: "🦷" }],
  [/law|legal|attorney/i, { vertical: "law firms", clientTerm: "clients", workflowIcon: "⚖️" }],
  [/clinic|med(ical|ical)|doctor/i, { vertical: "medical practices", clientTerm: "patients", workflowIcon: "🩺" }],
  [/real\s*estate/i, { vertical: "real estate offices", clientTerm: "buyers", workflowIcon: "🏠" }],
  [/hvac|plumb/i, { vertical: "home service businesses", clientTerm: "homeowners", workflowIcon: "🔧" }]
];

const FOCUS_RULES = [
  [/bill(ing)?|invoice|quickbooks/i, { focus: "automated billing ledgers", taskName: "invoice matching" }],
  [/schedul(e|ing)|calendar|booking/i, { focus: "direct calendar scheduling", taskName: "appointment booking" }],
  [/document|signature|intake/i, { focus: "secure intake document routing", taskName: "agreement signing" }]
];

const IMAGE_ASSETS = [
  "black_female_founder_consultant.png",
  "collaborative_scoping_1779798801153.png",
  "3_empowered_systems_consultant.png",
  "2_operations_director_smb.png",
  "diverse_male_entrepreneur_1779798785119.png",
  "hispanic_female_retail_owner.png"
];

function matchRule(rules, brief, fallback) {
  for (const [pattern, value] of rules) {
    if (pattern.test(brief)) return value;
  }
  return fallback;
}

/** Tue/Thu/Fri publishing slots for the target month (2026). */
function publishingDates(monthNum) {
  const dates = [];
  const d = new Date(2026, monthNum, 1);
  while (dates.length < 6 && d.getMonth() === monthNum) {
    if (d.getDay() === 2 || d.getDay() === 4 || d.getDay() === 5) {
      dates.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function formatDate(dateObj) {
  return `${DAY_NAMES[dateObj.getDay()]} ${MONTH_NAMES[dateObj.getMonth()]} ${dateObj.getDate()}`;
}

function generateMonthlyPosts(month, brief) {
  const mData = MONTHS_MAP[month] || { num: 7, days: 31 };
  const dates = publishingDates(mData.num);

  const { vertical } = matchRule(VERTICAL_RULES, brief, { vertical: "small businesses", clientTerm: "customers", workflowIcon: "⚙️" });
  const { focus, taskName } = matchRule(FOCUS_RULES, brief, { focus: "automated bridges", taskName: "data syncing" });

  const postTitles = [
    `The Invisible Tax: Manual ${taskName} in ${vertical}`,
    `Auditing Your Problem Zero: Surgical process scoping for ${vertical}`,
    `Sustainable Growth: Decoupling carbon footprints and headcount cuts`,
    `Stop routing data by hand: Secure ${focus} in action`,
    `Visualizing capacity: The 24-hour setup workflow`,
    `Solution-First Automation: Upskilling your front desk`
  ];

  const generatedPosts = [];
  for (let i = 0; i < 6; i++) {
    const postNum = i + 1;
    const targetDate = dates[i];
    const title = postTitles[i];
    const isFriday = targetDate.getDay() === 5;
    const utmToken = `post_gen_${month.toLowerCase()}_0${postNum}`;

    const linkedin = `**Subject**: The manual ${taskName} bottleneck in your office.

If you run one of today's ${vertical}, your staff is likely losing 10+ hours a week copy-pasting client records or manually reconciling accounting files.

At AiWorXmiths, we design secure, Human-in-the-Loop systems to automate this overhead. We focus on B2B business expansion, upskilling your team to supervise these automation engines rather than cutting headcount.

🔗 **Book your Free Consultation: https://aiworxmiths.com/services?utm_source=linkedin&utm_medium=social&utm_campaign=consultancy_sprints&utm_content=${utmToken}**`;

    const threads = `How many hours does your team waste on manual ${taskName} every week? 

We help ${vertical} replace these manual bridges with secure, low-compute automations, upskilling your front desk to oversee them. Human-first, growth-first.

🔗 **Reclaim your capacity. Book a free scoping call at AiWorXmiths.com: https://aiworxmiths.com/services?utm_source=threads&utm_medium=social&utm_campaign=consultancy_sprints&utm_content=${utmToken}**`;

    const instagram = `*   **Slide 1**: Streamlining operations in ${vertical}. (Visual: Professional setup with modern tech).
*   **Slide 2**: Manual ${taskName} is a silent drain on team focus and client trust.
*   **Slide 3**: The Fix: Secure, containerized private-cloud connectors.
*   **Slide 4**: We prioritize upskilling your team over headcount reductions.
*   **Slide 5**: Get paid faster Book a Free Consultation: Link in Bio (AiWorXmiths.com)`;

    const blog = `# ${title}

Manual workflows slow down modern ${vertical}. In this article, we explain how deploying custom ${focus} natives protects client confidentiality, lowers energy footprints, and frees team capacity.

[Book a free diagnostics consultation](https://aiworxmiths.com/services?utm_source=blog&utm_medium=social&utm_campaign=consultancy_sprints&utm_content=${utmToken})`;

    generatedPosts.push({
      id: `post_gen_${month.toLowerCase()}_0${postNum}`,
      week: String(Math.floor(i / 3) + 1),
      date: formatDate(targetDate),
      dayNum: targetDate.getDate(),
      month: month,
      campaign: "consultancy_sprints",
      type: "AI Consulting Audit",
      title: title,
      image: IMAGE_ASSETS[i],
      imgAlt: `${title} visual representation.`,
      status: isFriday ? "PENDING" : "APPROVED",
      linkedin: linkedin,
      threads: threads,
      instagram: instagram,
      blog: blog,
      comments: []
    });
  }

  return generatedPosts;
}

module.exports = { generateMonthlyPosts };

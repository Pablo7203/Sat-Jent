# CHAPTER NINE: LEGAL, SOCIAL, ETHICAL AND PROFESSIONAL ISSUES

_Working draft. This chapter identifies relevant considerations; it does not certify that SAT-J or SAT-J Ent is legally compliant. Ghana’s Data Protection Act, 2012 and Cybersecurity Act, 2020 are older than five years but remain primary legal sources and should be cited where applicable. The business should obtain appropriate professional advice for compliance decisions._

## 9.1 Examination of Legal and Ethical Issues

SAT-J Ent supports records relating to employees, customers, suppliers, sales, payments and business operations. Some of these records may identify individuals or reveal information about their interactions with the business. Their collection, use, storage and access therefore raise privacy and security responsibilities.

Ghana’s Data Protection Act, 2012 (Act 843) establishes requirements for the processing of personal data and the Data Protection Commission. Although the Act is older than the project’s preferred five-year citation window, it is a primary legal authority and its age does not remove its relevance. The Data Protection Commission’s current guidance states that data controllers and processors intending to process personal data must register, appoint and train a data protection supervisor, and take reasonable technical and organisational measures to secure personal data (Data Protection Commission, n.d.-a). Whether these duties apply to SAT-J in a particular way should be determined by the organisation, based on its role and actual processing activities.

The system’s technical design supports some privacy and security principles by requiring employee authentication, applying role and branch permissions, and restricting database access through row-level security. Public catalogue projections are designed to expose only approved public fields, and the public website is currently disabled by default. These controls are technical measures; they do not alone establish legal compliance. The organisation also needs appropriate privacy notices, retention practices, user training, access administration and incident procedures.

The Data Protection Commission’s current online guidance describes a breach-notification process and says that, where feasible, a material personal data breach should be notified without delay and within 72 hours of awareness (Data Protection Commission, n.d.-b). SAT-J should verify the applicable reporting obligations and maintain a practical process for detecting, assessing and escalating incidents. The application’s logging should also avoid recording passwords, session tokens, payment details or unnecessary personal information.

Ghana’s Cybersecurity Act, 2020 (Act 1038) establishes the Cyber Security Authority and provides the national legal framework for cybersecurity activities. The system is a business management application rather than critical information infrastructure on the evidence reviewed, and this chapter does not claim that it falls into a specially regulated category. The Act is relevant as part of Ghana’s cybersecurity context, while the Authority’s National Cybersecurity Policy and Strategy for 2023–2027 highlights technical, organisational, legal and capacity-building measures for a secure digital environment (Cyber Security Authority, 2024).

Ethically, data should be collected only for legitimate business purposes and made available only to people who need it for their work. Customer contact details and payment references should not be reused for unrelated purposes without an appropriate basis. Employee monitoring and audit logs should be proportionate and transparent. During demonstrations and academic evaluation, synthetic or anonymised information should be used wherever possible.

**[IMAGE PLACEHOLDER 9.1: Privacy and security controls in SAT-J Ent]**

_Suggested image: an access-control flow or a redacted screenshot of the role/branch access configuration. Do not include live credentials, real employee contact details or identifiable customer records._

## 9.2 Social Implications of the Project

Digitising operations across three branches may make shared product, stock, purchasing and sales information easier to review. It can also support more consistent processes between locations and help management access reports without gathering each figure manually. These are potential benefits of the system design; they should not be stated as measured outcomes until the application has been used and evaluated in the business.

Digital change can also affect staff responsibilities. Employees may need training to use the application and understand the correct workflow for a transaction. For example, a branch transfer requires separate dispatch and receipt steps, and a daily sales batch does not record a customer payment. If these distinctions are not understood, staff could enter incomplete or incorrect records. Training materials and a controlled pilot would help address this risk.

The application also depends on internet connectivity for server-backed operations. Since offline transaction capture is not implemented, a network interruption may prevent employees from completing some tasks in the system. SAT-J should consider how existing business procedures will operate during an outage and whether that limitation is acceptable at each branch. If offline use is later required, it should be designed and tested explicitly rather than assumed.

Access to suitable devices and digital skills may differ between employees. A responsive interface can improve access across screen sizes, but it does not remove the need for appropriate devices, connectivity, training and support. Keeping responsibilities clear and providing staff assistance during transition can reduce the chance that digital processes exclude some employees or shift work unfairly to particular roles.

## 9.3 Professional Practices and Compliance

Professional software practice requires honest communication about what has been built and tested. This report therefore distinguishes implemented features from disabled, incomplete, planned or unverified capabilities. It does not describe the system as offline-first, fully accounting-compliant, production-deployed or user-accepted without evidence to support those claims.

The project’s engineering practices include version-controlled source code, timestamped database migrations, input validation, role and branch checks, audit records, automated tests and explicit transaction workflows. The NIST Secure Software Development Framework recommends integrating security practices throughout software development and responding to vulnerabilities systematically (Scarfone, Souppaya and Dodson, 2022). In this project, that guidance supports documenting security requirements, preserving test evidence and treating failed or blocked checks as unresolved rather than as passes.

Professional responsibility also includes protecting source and operational data. Environment files may contain credentials and must not be included in the report or shared screenshots. Test data should be clearly identified, and real business records should only be used with appropriate authorisation. Third-party libraries and platform services should be acknowledged accurately, and external material should be cited using the required academic style.

Before live operational use, SAT-J should confirm its data-protection responsibilities, register with the Data Protection Commission where required, provide suitable privacy information, establish retention and access procedures, and assign responsibility for security incidents and system administration. These are organisational responsibilities and cannot be completed solely through code.

**[IMAGE PLACEHOLDER 9.2: Professional development evidence or security testing summary]**

_Possible evidence: anonymised security test summary, code review checklist or version-control milestone history. Include only genuine records and do not expose secrets or private operational details._

## 9.4 Conclusion

This chapter has considered privacy, cybersecurity, staff impact and professional responsibility in relation to SAT-J Ent. Ghana’s Data Protection Act, 2012 and Cybersecurity Act, 2020 provide relevant legal context, while current Data Protection Commission guidance and Ghana’s cybersecurity strategy provide more recent implementation context. The system includes technical access controls and data protections, but those controls do not by themselves establish organisational or legal compliance.

Digitisation across three branches offers potential operational benefits, while also creating responsibilities around staff training, connectivity, data quality and fair access. The final report should remain transparent about system limitations and testing gaps. Before business-wide use, SAT-J should validate workflows with staff, confirm its data-protection obligations, complete operational security and recovery preparations, and assess the system through a controlled pilot.

## References cited in Chapter Nine

Cyber Security Authority (2024) _National Cybersecurity Policy and Strategy 2023–2027_. Accra: Cyber Security Authority, Ghana. Available at: https://www.csa.gov.gh/resources/National%20Cybersecurity%20Policy%20and%20Strategy.pdf (Accessed: 4 November 2026).

Data Protection Commission (n.d.-a) ‘For Organisations’. Available at: https://dpc.gov.gh/for-organisations/ (Accessed: 4 November 2026).

Data Protection Commission (n.d.-b) ‘Guidance: How to file a 72-hour breach notification’. Available at: https://app.dpc.gov.gh/guidance (Accessed: 4 November 2026).

Ghana (2012) _Data Protection Act, 2012 (Act 843)_. Available at: https://ghalii.org/akn/gh/act/2012/843/eng%402012-05-18 (Accessed: 4 November 2026).

Ghana (2020) _Cybersecurity Act, 2020 (Act 1038)_. Available at: https://www.cybersecurity.gov.gh/documents/Cybersecurity%20Act%202020%20%28Act%201038%29.pdf (Accessed: 4 November 2026).

Scarfone, K., Souppaya, M. and Dodson, D. (2022) _Secure Software Development Framework (SSDF) Version 1.1: Recommendations for Mitigating the Risk of Software Vulnerabilities_. NIST Special Publication 800-218. National Institute of Standards and Technology. Available at: https://doi.org/10.6028/NIST.SP.800-218.

---

### Items to confirm before finalising this chapter

- Whether SAT-J is registered with Ghana’s Data Protection Commission and who is responsible for privacy oversight.
- Whether a privacy notice, retention policy, staff training or breach-response procedure exists.
- Whether the school accepts older statutes as exceptions to the five-year source preference (recommended, because they are primary legal sources).
- Whether any staff or customer data was used during testing and what consent or anonymisation process was followed.
- Whether the application will be piloted or used at all three branches, and what connectivity fallback procedures are planned.

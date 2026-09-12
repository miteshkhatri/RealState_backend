const db = require('../utils/helpers');
const multer = require('multer');
const path = require('path');

// ================= Multer Config =================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // apna upload folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

// Image + PDF allow
const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf'
];

const allowedExt = ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.pdf'];



const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimetypeOk = allowedMimeTypes.includes(file.mimetype);
    const extOk = allowedExt.includes(ext);

    console.log('📂 Uploading:', file.originalname, '| MIME:', file.mimetype);

    if (mimetypeOk && extOk) {
      return cb(null, true);
    } else {
      return cb(new Error('Only image or pdf files are allowed'));
    }
  }
}).fields([
  // 🟢 LAND ATTACHMENTS (land_attachments table)
  { name: 'land_chain_docs', maxCount: 5 },      // Land Chain Documents
  { name: 'poa_doc', maxCount: 5 },             // POA Documents
  { name: 'map_file', maxCount: 5 },            // Map / Master Plan

  // 🟠 CONVERSION ATTACHMENTS (conversion_attachments table)
  { name: 'conversion_challan_copy', maxCount: 5 },        // Challan Copy
  { name: 'conversion_order_attachment', maxCount: 5 },    // Conversion Order
  { name: 'conversion_map_attachment', maxCount: 5 },      // Conversion Map

  // 🟡 Seller KYC docs
  { name: 'seller_pan', maxCount: 5 },          // Seller PAN file(s)
  { name: 'seller_aadhaar', maxCount: 5 },      // Seller Aadhaar file(s)
  { name: 'seller_poa_pan', maxCount: 5 },      // POA PAN file(s)
  { name: 'khasra_file', maxCount: 5 },         // Khasra / Chak docs
  { name: 'upniveshan_khasra_file', maxCount: 5 }, // Upniveshan Khasra / Chak Docs

  // 🔵 RERA docs / Allotment docs
  { name: 'tir_report_file', maxCount: 5 },
  { name: 'valuation_report_file', maxCount: 5 },
  { name: 'allotment_attachment', maxCount: 5 },
  { name: 'related_payment_file', maxCount: 5 },
  { name: 'plot_patta_attachment', maxCount: 5 }
]);

// 👇👇👇 ADD HERE (safeStr ke just baad)

const safeNull = (v) => {
  if (v === undefined || v === null || v === '') return null;

  // ✅ ARRAY FIX
  if (Array.isArray(v)) return v[0];   // first value use karo

  return v;
};

const safeNumber = (v) => {
  if (v === undefined || v === null || v === '') return null;
  return Number(v);
};


  exports.Propertiesadd = async (req, res) => {
    upload(req, res, async (err) => {
      if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({ success: false, message: err.message });
      }

      const {
        // ⭐ sellers JSON (array) + seller section area
        land_chain_docs_date = [],
  map_file_date = [],
  poa_doc_date = [],
        sellers: sellersJson,
        seller_area,
  tir_report_date,
  valuation_report_date,
  allotment_date,
  // payment_date,
        // Land (land table ke fields)
        land_area_type,
        land_area,
        upni_no_or_chak_no,
        upni_type,
        rajaswa_no,
       
        murbba_type,
       murbba_no,
kila_no,
mutation_status,
jamabandi_status,
girdawari_status,
payable_amount,
        land_remarks,

        // ⭐ EXTRA DATES
        land_date,
        map_date,

        // properties_payment table ke fields
    

        // KYC Date
        kyc_date,
        rajaswaDocDate,       // ⭐ NEW: rajaswa KHASRA ki date
        upniveshanDocDate,    // ⭐ NEW: upniveshan KHASRA ki date

        // Conversion fields
        conversion_application_date,
        conversion_order_date,
        provision_section,
        division_of_area,
        converted_area,
        conversion_authority,
        conversion_challan_date,
      conversion_map_date,

        // RERA + Allotment fields
        rera_registration_number,
        rera_documents_date,
        patta_applied_date,
        patta_received_date,
        allotment_direct_customer,
        conversion_order_date2,
        buyer_area,

         project_name,
        
  project_font,

        // Land attachments ki date (Attachments section ka date input)
        document_date,
      } = req.body;

      const now = new Date();
      const formattedDateTime = now.toISOString().slice(0, 19).replace('T', ' '); // MySQL DATETIME
      const todayDate = formattedDateTime.slice(0, 10); // YYYY-MM-DD

      const connection = db;

      // helper: null/undefined/"null" -> ""
      const safeStr = (val) => {
        if (val === undefined || val === null) return '';
        const s = String(val).trim();
        if (s.toLowerCase() === 'null') return '';
        return s;
      };
      // 🔹 helper: form-data values ko hamesha array banane ke liye
const normalizeArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return [v];
};

// 🔹 attachment dates (IMPORTANT FIX)
const chainDates = normalizeArray(land_chain_docs_date);
const mapDates   = normalizeArray(map_file_date);
const poaDates   = normalizeArray(poa_doc_date);
const rajaswaDates = normalizeArray(rajaswaDocDate);
const upniveshanDates = normalizeArray(upniveshanDocDate);
const challanDates = normalizeArray(conversion_challan_date);
const orderDates   = normalizeArray(conversion_order_date);
const conversionmapDates     = normalizeArray(conversion_map_date);
const tirDatesArr = normalizeArray(tir_report_date);
const valuationDatesArr = normalizeArray(valuation_report_date);



      // ⭐ sellers JSON parse

      // ✅ PAYMENTS JSON PARSE + VALIDATION
let paymentsArray = [];

if (req.body.all_payments) {
  try {
    paymentsArray =
      typeof req.body.all_payments === 'string'
        ? JSON.parse(req.body.all_payments)
        : req.body.all_payments;

    if (!Array.isArray(paymentsArray)) paymentsArray = [];
  } catch (e) {
    paymentsArray = []; // ❌ error throw नहीं करेंगे
  }
}

// ================= FINAL AMOUNT VALIDATION =================

// Payable Amount (land level)
// const payableAmountNum = Number(payable_amount) || 0;

// for (const p of paymentsArray) {
//   const consideration = Number(p.considerationAmount) || 0;
//   const adminEdit     = Number(p.paymentAdmin) || 0;

//   const finalAmount = consideration + adminEdit;

//   if (finalAmount > payableAmountNum) {
//     return res.status(400).json({
//       success: false,
//       message:
//         `अंतिम राशि (₹${finalAmount}) ` +
//         `देय राशि (₹${payableAmountNum}) से अधिक नहीं हो सकती`
//     });
//   }
// }


      let sellersArray = [];
      if (sellersJson) {
        try {
          sellersArray = JSON.parse(sellersJson);
          if (!Array.isArray(sellersArray)) sellersArray = [];
        } catch (e) {
          console.error('Error parsing sellers JSON:', e);
          return res.status(400).json({
            success: false,
            message: 'Invalid sellers payload (JSON parse error)',
          });
        }
      }

      // ✅ MULTIPLE SELLERS REQUIRED
      if (!Array.isArray(sellersArray) || sellersArray.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one seller is required',
        });
      }

      // Primary seller array se pick karo (index 0)
      const primarySellerFromArray = sellersArray[0] || null;

      const finalSellerName = safeStr(
        primarySellerFromArray?.seller_name ||
        primarySellerFromArray?.name
      );

      if (!finalSellerName || finalSellerName.trim() === '') {
        return res
          .status(400)
          .json({ success: false, message: 'Seller name is required' });
      }

      if (!land_area_type || String(land_area_type).trim() === '') {
        return res
          .status(400)
          .json({ success: false, message: 'land_area_type is required' });
      }

      // default font (agar kisi seller ke liye specific font_name na ho)
      const defaultFont =
        primarySellerFromArray &&
        primarySellerFromArray.font_name !== undefined &&
        primarySellerFromArray.font_name !== null &&
        String(primarySellerFromArray.font_name).trim() !== ''
          ? Number(primarySellerFromArray.font_name)
          : 0;



      

let propertyType = 0;

const adcRaw = req.body.allotment_direct_customer;

if (adcRaw !== undefined && adcRaw !== null) {
  const adc = String(adcRaw).trim().toLowerCase();

  if (adc === 'yes' || adc === '1' || adc === 'true') {
    propertyType = 1;
  } 
  else if (adc === 'no' || adc === '2' || adc === 'false') {
    propertyType = 2;
  }
}

console.log('🧩 allotment_direct_customer:', adcRaw, '→ TYPE:', propertyType);


let projectId = null;

// 🔥 ONLY WHEN allotment_direct_customer HAS yes / no
if (
  allotment_direct_customer !== undefined &&
  allotment_direct_customer !== null &&
  String(allotment_direct_customer).trim() !== '' &&
  project_name &&
  project_name.trim() !== ''
) {

  const rows = await connection.fetchQuery(
    'SELECT project_id FROM projects WHERE name = ? AND is_delete = 0 LIMIT 1',
    [project_name.trim()]
  );

  if (rows.length > 0) {
    // ✅ PROJECT EXISTS → UPDATE TYPE
    projectId = rows[0].project_id;

    await connection.insertQuery(
      `UPDATE projects
       SET type = ?, update_at = ?
       WHERE project_id = ?`,
      [propertyType, formattedDateTime, projectId]
    );

  } else {
    // ➕ CREATE PROJECT
    const insertRes = await connection.insertQuery(
      `INSERT INTO projects
       (name, krutiDev_font, type, create_at, update_at, is_delete)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [
        project_name.trim(),
        project_font ?? defaultFont,
        propertyType,
        formattedDateTime,
        formattedDateTime,
      ]
    );

    projectId = insertRes.insertId;
  }

} else {
  console.log('ℹ️ allotment_direct_customer empty → project skipped');
}

// 🔒 allotment_direct_customer empty → projectId force NULL
if (
  allotment_direct_customer === undefined ||
  allotment_direct_customer === null ||
  String(allotment_direct_customer).trim() === ''
) {
  projectId = null;
}

console.log('✅ Project resolved:', project_name, 'ID:', projectId, 'TYPE:', propertyType);

     
      try {
        // ========== 1) SELLER INSERT (MULTIPLE ONLY) ==========
       const sellerInsertQuery = `
  INSERT INTO sellers
  (
    name,
    relation_type,
    relation_name,
    age,
    address,
    mobile,
    aadhaar,
    pan_no,
    area,
    area_type,
    mutation_status,
    jamabandi_status,
    girdawari_status,
    party_type,
    font_name,
    poa_holder_name,
    remarks,
    created_at,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;


        let sellerId = null; // primary seller id (jo land me use hogi)
        const sellerIds = [];

        const sectionArea = safeStr(seller_area); // formData.seller_area se aayega

        for (const s of sellersArray) {
          const name = safeStr(s.seller_name || s.name);
          if (!name) continue; // blank seller skip kar do

          // 🔹 HOLDER / COMPANY check
          const isHolderType =
            String(s.type || 'seller').toLowerCase() === 'holder';

          // 🔹 relation_type + relation_name + poa mapping
          let relationType;
          let relationName;
          let poa;

        if (isHolderType) {
  // ✅ COMPANY / HOLDER CASE
  relationType = 'DIRECTOR';

  // 🔥 DIRECTOR NAME yahan save hona chahiye
  relationName = safeStr(s.director_name);

  // 🔥 POA HOLDER alag column me
  poa = safeStr(s.poa_holder_name);
} else {
  // ✅ NORMAL SELLER CASE
  relationType = safeStr(s.relation);    // S/O | W/O | D/O
  relationName = safeStr(s.fatherName);
  poa          = safeStr(s.poa_holder_name);
}


          const ageVal        = safeStr(s.age);
          const addressVal    = safeStr(s.address);
          const mobileVal     = safeStr(s.mobile);
          const aadhaarVal    = safeStr(s.aadhaar);
           const Addpen        = safeStr(s.pan)

          // area: per-seller agar aaya ho, otherwise section level seller_area
          const areaVal       = safeStr(s.area || sectionArea);

          // type: 'seller' / 'holder' -> party_type: 'seller' / 'company'
          const partyType = isHolderType ? 'company' : 'seller';

          const remarks  = safeStr(s.seller_remarks);

          const fontVal =
            s.font_name !== undefined && s.font_name !== null
              ? Number(s.font_name)
              : defaultFont;

       const result = await connection.insertQuery(sellerInsertQuery, [
  name,
  relationType || null,
  relationName || null,
  ageVal || null,
  addressVal || null,
  mobileVal || null,
  aadhaarVal || null,
  Addpen || null,
  areaVal || null,

  // 🔥 NEW FIELDS (FROM FRONTEND PAYLOAD)
  safeStr(s.area_type) || null,
  safeStr(s.mutation_status) || null,
  safeStr(s.jamabandi_status) || null,
  safeStr(s.girdawari_status) || null,

  partyType,
  fontVal,
  poa || null,
  remarks || null,
  formattedDateTime,
  formattedDateTime,
]);

          const insertedId = result.insertId;
          sellerIds.push(insertedId);
          if (!sellerId) sellerId = insertedId; // pehla seller primary
        }

        if (!sellerId) {
          // array me sab blank the
          return res.status(400).json({
            success: false,
            message: 'At least one seller with name is required',
          });
        }

        console.log(
          '✅ Sellers created with IDs:',
          sellerIds,
          'primary:',
          sellerId
        );

        // ========== 1.1) SELLER KYC DOCUMENT INSERT ==========  ⭐ UPDATED DATES ONLY



        // ========== 2) BUYER INSERT (MULTIPLE) ==========

       const buyerInsertQuery = `
  INSERT INTO buyers
  (
    seller_id,
    name,
    mobile_number,
    address,
    aadhar_number,
    pan_number,
    party_type,
    area,
    area_type,
    mutation_status,
    jamabandi_status,
    girdawari_status,
    relation_prefix,
    age,
    prefix_name,
    reference,
    created_at,
    updated_at,
    deleted_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
`;


        let buyerId = null;
        const buyerIds = [];
        let buyersArray = [];

        if (req.body.buyers) {
          try {
            buyersArray = JSON.parse(req.body.buyers);
          } catch (parseErr) {
            console.error('Error parsing buyers JSON:', parseErr);
            return res.status(400).json({
              success: false,
              message: 'Invalid buyers payload (JSON parse error)',
            });
          }
        }

        if (Array.isArray(buyersArray) && buyersArray.length > 0) {
          for (const b of buyersArray) {
            const buyerName  = safeStr(b.name || b.buyer_name);
            const mobile     = safeStr(b.mobile || b.mobile_number);
            const address    = safeStr(b.address);
            const aadhar     = safeStr(b.aadhaar || b.aadhar_number);
            const pan        = safeStr(b.pan || b.pan_number);
            const relation   = safeStr(b.relation || b.relation_prefix);
            const age        = safeStr(b.age);
            const fatherName = safeStr(b.fatherName || b.prefix_name);
            const ref        = safeStr(b.reference);

            // 🔹 NEW: area (per buyer)
            const buyerArea  = safeStr(b.area);

            // 🔹 NEW: party_type (buyer/company) - UI se 'type' aaye to usse map
            const buyerPartyTypeRaw = String(b.type || 'buyer').toLowerCase();
            const buyerPartyType =
              buyerPartyTypeRaw === 'holder' || buyerPartyTypeRaw === 'company'
                ? 'company'
                : 'buyer';

            // 🔒 SAFETY: completely blank buyer ko skip karo
            if (
              !buyerName &&
              !mobile &&
              !aadhar &&
              !pan &&
              !address &&
              !relation
            ) {
              continue;
            }

    const result = await connection.insertQuery(buyerInsertQuery, [
  sellerId,
  buyerName || null,
  mobile || null,
  address || null,
  aadhar || null,
  pan || null,
  buyerPartyType,
   buyerArea || null,

  // 🔥 NEW BUYER FIELDS
  safeStr(b.area_type) || null,
  safeStr(b.mutation_status) || null,
  safeStr(b.jamabandi_status) || null,
  safeStr(b.girdawari_status) || null,

  relation || null,
  age || null,
  fatherName || null,
  ref || null,
  formattedDateTime,
  formattedDateTime,
]);


            if (!buyerId) {
              buyerId = result.insertId;
            }
            buyerIds.push(result.insertId);
          }

          console.log('✅ Buyers created with IDs:', buyerIds);
        } else {
          
          console.log('ℹ️ No buyers provided, skipping buyers insert.');
        }

       
       const landInsertQuery = `
  INSERT INTO land
  (
    seller_id,
    land_area_type,
    land_area,
    upni_no_or_chak_no,
    upni_type,
    rajaswa_no,
    murbba_no,
    kila_no,
    murbba_type,
    mutation_status,
    jamabandi_status,
    girdawari_status,
    remarks,
    payable_amount
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;


const landValues = [
  Number(sellerId),                             // seller_id
  String(land_area_type).toUpperCase(),         // land_area_type
  safeNumber(land_area),                        // land_area
  safeNull(upni_no_or_chak_no),                 // upni_no_or_chak_no
  String(upni_type).toUpperCase(),              // upni_type
  safeNull(rajaswa_no),                         // ✅ FIXED HERE
  safeNull(murbba_no),                          // murbba_no
  safeNull(kila_no),                            // kila_no
  safeNull(murbba_type),                        // murbba_type
  safeNull(mutation_status),                   // mutation_status
  safeNull(jamabandi_status),                  // jamabandi_status
  safeNull(girdawari_status),                  // girdawari_status
  safeNull(land_remarks),                      // remarks
  safeNumber(payable_amount),                  // payable_amount
];

console.log('LAND INSERT VALUES:', landValues);


console.log('LAND INSERT VALUES:', landValues); // 🔍 test ke liye

const landResult = await connection.insertQuery(
  landInsertQuery,
  landValues
);

        const landId = landResult.insertId;
        console.log('✅ Land created with ID:', landId);



               let sellerKycId = null;

if (sellerId) {
  // ✅ ALWAYS declare first
  const rowsToInsert = [];

  const panFiles = Array.isArray(req.files?.seller_pan)
    ? req.files.seller_pan
    : [];
  const aadhaarFiles = Array.isArray(req.files?.seller_aadhaar)
    ? req.files.seller_aadhaar
    : [];
  const poaPanFiles = Array.isArray(req.files?.seller_poa_pan)
    ? req.files.seller_poa_pan
    : [];
  const khasraFiles = Array.isArray(req.files?.khasra_file)
    ? req.files.khasra_file
    : [];
  const upniveshanKhasraFiles = Array.isArray(
    req.files?.upniveshan_khasra_file
  )
    ? req.files.upniveshan_khasra_file
    : [];

  // ✅ BASE DATE (PAN / AADHAAR / POA)
  const baseKycDate =
    (kyc_date && String(kyc_date).trim()) || todayDate;

  // ✅ dates arrays (upar normalizeArray se aaye honge)
  // const rajaswaDates = normalizeArray(rajaswaDocDate);
  // const upniveshanDates = normalizeArray(upniveshanDocDate);

  const hasAllDocs = !!(
    panFiles.length &&
    aadhaarFiles.length &&
    poaPanFiles.length
  );
  const verifiedStatus = hasAllDocs ? 1 : 0;

  const sellerKycInsertQuery = `
    INSERT INTO seller_kyc_document
    (
      seller_id,
      land_id,
      verified_status,
      document_date,
      file_type,
      file_path,
      created_at,
      updated_at,
      deleted_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?,?, NULL)
  `;

  /* ========= PAN / AADHAAR / POA PAN ========= */
  panFiles.forEach((f) =>
    rowsToInsert.push({
      type: 'PAN',
      path: f.filename,
      docDate: baseKycDate,
    })
  );

  aadhaarFiles.forEach((f) =>
    rowsToInsert.push({
      type: 'AADHAAR',
      path: f.filename,
      docDate: baseKycDate,
    })
  );

  poaPanFiles.forEach((f) =>
    rowsToInsert.push({
      type: 'POA_PAN',
      path: f.filename,
      docDate: baseKycDate,
    })
  );

  /* ========= KHASRA (rajaswaDocDate[]) ========= */
  khasraFiles.forEach((f, index) =>
    rowsToInsert.push({
      type: 'KHASRA',
      path: f.filename,
      docDate:
        rajaswaDates[index] && String(rajaswaDates[index]).trim()
          ? rajaswaDates[index]
          : baseKycDate,
    })
  );

  /* ========= UPNIVESHAN KHASRA (upniveshanDocDate[]) ========= */
  upniveshanKhasraFiles.forEach((f, index) =>
    rowsToInsert.push({
      type: 'UPNIVESHAN_KHASRA',
      path: f.filename,
      docDate:
        upniveshanDates[index] && String(upniveshanDates[index]).trim()
          ? upniveshanDates[index]
          : baseKycDate,
    })
  );

  /* ========= SAFETY FALLBACK ========= */
  if (rowsToInsert.length === 0) {
    rowsToInsert.push({
      type: null,
      path: null,
      docDate: baseKycDate,
    });
  }

  /* ========= INSERT ========= */
  for (const row of rowsToInsert) {
    const result = await connection.insertQuery(
      sellerKycInsertQuery,
      [
        sellerId,
         landId,
        verifiedStatus,
        row.docDate,
        row.type,
        row.path,
        formattedDateTime,
        formattedDateTime,
      ]
    );

    if (!sellerKycId) {
      sellerKycId = result.insertId;
    }
  }

  console.log(
    '✅ Seller KYC rows inserted:',
    rowsToInsert.length,
    'first ID:',
    sellerKycId,
    'Status:',
    verifiedStatus
  );
}
        // 🔥 FIX: sellers table me land_id insert / update
// 🔥 FIX: correct placeholders for IN clause
if (landId && sellerIds.length > 0) {
  const placeholders = sellerIds.map(() => '?').join(',');

  const updateSellerLandQuery = `
    UPDATE sellers
    SET land_id = ?
    WHERE id IN (${placeholders})
  `;

  await connection.insertQuery(
    updateSellerLandQuery,
    [landId, ...sellerIds]
  );

  console.log('✅ land_id updated in sellers table:', landId);
}



   let propertiesPaymentId = null;

if (landId && paymentsArray.length > 0) {
  const paymentInsertQuery = `
    INSERT INTO properties_payment
    (
      land_id,
      physical_possession_status,
      payment_a,
      payment_admin_entry,
      consideration_amount,
      compensation_payment,
      land_category,
      payment_mode,
      bank_name,
      branch_name,
      cheque_no,
      payment_date,
      created_at,
      updated_at,
      deleted_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `;

  for (let i = 0; i < paymentsArray.length; i++) {
    const p = paymentsArray[i] || {};

    // 🔒 per-row SAFE values (blank allowed)
    const result = await connection.insertQuery(paymentInsertQuery, [
      landId,
      safeStr(p.physicalPossession) || null,
      safeStr(p.paymentA) || null,
      safeStr(p.paymentAdmin) || null,
      Number(p.considerationAmount) || null,
      Number(p.compensationPayment) || null,
      safeStr(p.category) || null,
      safeStr(p.paymentMode) || null,
      safeStr(p.bankName) || null,
      safeStr(p.branchName) || null,
      safeStr(p.chequeNo) || null,
      p.paymentDate || null,
      formattedDateTime,
      formattedDateTime,
    ]);

    // first payment ko primary maan lo
    if (i === 0) {
      propertiesPaymentId = result.insertId;
    }
  }

  console.log(
    '✅ Payments inserted:',
    paymentsArray.length,
    'Primary ID:',
    propertiesPaymentId
  );
}


  
// ========== 3.2) CONVERSION_DETAILS + conversion_attachments ==========
let conversionId = null;
let conversionAttachmentsCount = 0;
 let divisionDetailsObj = {};

/* ========= SAFE HELPERS (VERY IMPORTANT) ========= */
const safeDate = (v) => {
  if (!v) return null;

  // array case
  if (Array.isArray(v)) {
    const clean = v.find(d => d && String(d).trim() !== '');
    return clean ? String(clean).trim() : null;
  }

  // "2026-01-08,," case
  const cleaned = String(v)
    .split(',')
    .find(d => d.trim() !== '');

  return cleaned ? cleaned.trim() : null;
};


const safeVarchar = (v) =>
  v && String(v).trim() !== '' ? String(v).trim() : null;

const safeAuthority = (v) => {
  const allowed = ['BDA', 'JDA', 'HB', 'OTHER'];
  if (!v) return null;
  const val = String(v).toUpperCase();
  return allowed.includes(val) ? val : 'OTHER';
};

if (landId) {

  /* ================================
     1️⃣ division_details JSON PARSE
  ================================= */
 
  try {
    const raw =
      req.body.division_details ||
      req.body.divisionDetails ||
      '{}';

    divisionDetailsObj =
      typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    divisionDetailsObj = {};
  }

  // 👉 VARCHAR(50)
  const divisionOfAreaStr =
    Object.keys(divisionDetailsObj).length > 0
      ? Object.keys(divisionDetailsObj).join(',')
      : null;

  // 👉 VARCHAR(191) (DB type)
  const convertedAreaStr =
    converted_area !== undefined && converted_area !== ''
      ? String(converted_area)
      : null;

  /* ================================
     2️⃣ CHECK: ANY CONVERSION DATA?
  ================================= */
  const hasConversionBodyData =
    safeDate(conversion_application_date) ||
    safeDate(conversion_order_date) ||
    safeVarchar(provision_section) ||
    divisionOfAreaStr ||
    convertedAreaStr ||
    safeAuthority(conversion_authority);

  const hasConversionSourceFiles =
    req.files?.conversion_challan_copy?.length > 0 ||
    req.files?.conversion_order_attachment?.length > 0 ||
    req.files?.conversion_map_attachment?.length > 0;

  if (hasConversionBodyData || hasConversionSourceFiles) {

    /* ================================
       3️⃣ INSERT conversion_details
    ================================= */
    const conversionInsertQuery = `
      INSERT INTO conversion_details
      (
        land_id,
        application_date,
        order_date,
        provision_section,
        division_of_area,
        converted_area,
        authority,
        created_at,
        updated_at,
        deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `;

    const convResult = await connection.insertQuery(
      conversionInsertQuery,
      [
        landId,
        safeDate(conversion_application_date),
        safeDate(conversion_order_date),
        safeVarchar(provision_section),
        divisionOfAreaStr,               // ✅ VARCHAR
        convertedAreaStr,                // ✅ VARCHAR (FIXED)
        safeAuthority(conversion_authority), // ✅ ENUM SAFE
        formattedDateTime,
        formattedDateTime,
      ]
    );

    conversionId = convResult.insertId;
    console.log('✅ Conversion details created with ID:', conversionId);

    /* ================================
       4️⃣ INSERT conversion_attachments
    ================================= */
    if (conversionId) {
      const convFiles = [];

      const pushConversionFiles = (fieldName, attachmentType, dateArray) => {
        const arr = Array.isArray(req.files?.[fieldName])
          ? req.files[fieldName]
          : [];

        arr.forEach((file, index) => {
          convFiles.push({
            attachmentType,
            filePath: file.filename,
            documentDate:
              dateArray?.[index] && String(dateArray[index]).trim()
                ? dateArray[index]
                : todayDate,
          });
        });
      };

      pushConversionFiles(
        'conversion_challan_copy',
        'CHALLAN_COPY',
        challanDates
      );

      pushConversionFiles(
        'conversion_order_attachment',
        'CONVERSION_ORDER',
        orderDates
      );

      pushConversionFiles(
        'conversion_map_attachment',
        'MAP_ATTACHMENT',
        conversionmapDates
      );

      if (convFiles.length > 0) {
        const convAttachmentInsertQuery = `
          INSERT INTO conversion_attachments
          (
            conversion_id,
            attachment_type,
            file_path,
            uploaded_at,
            document_date,
            deleted_at
          )
          VALUES (?, ?, ?, ?, ?, NULL)
        `;

        for (const item of convFiles) {
          await connection.insertQuery(
            convAttachmentInsertQuery,
            [
              conversionId,
              item.attachmentType,
              item.filePath,
              formattedDateTime,
              item.documentDate,
            ]
          );
          conversionAttachmentsCount++;
        }

        console.log(
          '✅ Conversion attachments inserted:',
          conversionAttachmentsCount
        );
      }
    }
  } else {
    console.log(
      'ℹ️ No conversion data/files provided, skipping conversion.'
    );
  }
}

/* ================================
   5️⃣ INSERT division_of_area TABLE
================================= */
if (landId && conversionId && divisionDetailsObj) {

  await connection.insertQuery(
    `DELETE FROM division_of_area WHERE land_id = ?`,
    [landId]
  );

  const divisionInsertQuery = `
    INSERT INTO division_of_area
    (
      land_id,
      conversion_details_id,
      type,
      area,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  for (const [type, area] of Object.entries(divisionDetailsObj)) {
    if (!area || Number(area) === 0) continue;

    await connection.insertQuery(divisionInsertQuery, [
      landId,
      conversionId,
      type,
      Number(area),
      formattedDateTime,
      formattedDateTime,
    ]);
  }

  console.log('✅ division_of_area rows inserted');
}




const getReraDate = (fileType) => {
  let dateVal = null;

  if (fileType === 'TIR_REPORT') {
    dateVal = tir_report_date;
  } else if (fileType === 'VALUATION_REPORT') {
    dateVal = valuation_report_date;
  } else if (fileType === 'ALLOTMENT_ATTACHMENT') {
    dateVal = allotment_date;
  } else if (fileType === 'RELATED_PAYMENT') {
    dateVal = payment_date;
  }

  // ❗ undefined / empty → SQL NULL
  if (!dateVal || String(dateVal).trim() === '') {
    return null;
  }

  // ✅ store like: "2025-12-21"
  return String(dateVal).trim();
};
const hasAllotmentValue =
  allotment_direct_customer !== undefined &&
  allotment_direct_customer !== null &&
  String(allotment_direct_customer).trim() !== '';

const reraProjectId = hasAllotmentValue ? projectId : null;

const reraProjectName =
  project_name && project_name.trim() !== ''
    ? project_name.trim()
    : null;


        // ========== 3.3) RERA_ALLOTMENT INSERT ==========
       // ========== 3.3) RERA_ALLOTMENT INSERT (FIXED) ==========
let reraAllotmentId = null;

if (landId) {
  const reraNumber = rera_registration_number || null;
  const documentDate = rera_documents_date || null;
  const pattaAppliedDate = patta_applied_date || null;
  const pattaReceivedDate = patta_received_date || null;

  // 🔥 direct_customer_name FINAL LOGIC
let directCustomer = 2; // ✅ default = EMPTY case

if (
  allotment_direct_customer !== undefined &&
  allotment_direct_customer !== null &&
  String(allotment_direct_customer).trim() !== ''
) {
  const val = String(allotment_direct_customer).toLowerCase();

  if (val === 'yes' || val === '1' || val === 'true') {
    directCustomer = 1;
  } else if (val === 'no' || val === '0' || val === 'false') {
    directCustomer = 0;
  }
}


  // 🔹 FILE ARRAYS
  const tirFiles = Array.isArray(req.files?.tir_report_file)
    ? req.files.tir_report_file
    : [];
  const valuationFiles = Array.isArray(req.files?.valuation_report_file)
    ? req.files.valuation_report_file
    : [];
  const allotmentFiles = Array.isArray(req.files?.allotment_attachment)
    ? req.files.allotment_attachment
    : [];
  const relatedPaymentFiles = Array.isArray(req.files?.related_payment_file)
    ? req.files.related_payment_file
    : [];
  const pattaFiles = Array.isArray(req.files?.plot_patta_attachment)
    ? req.files.plot_patta_attachment
    : [];

  console.log('🧾 RERA FILES COUNT:', {
    tir: tirFiles.length,
    valuation: valuationFiles.length,
    allotment: allotmentFiles.length,
    related: relatedPaymentFiles.length,
    plotPatta: pattaFiles.length,
  });

  const reraInsertQuery = `
  INSERT INTO rera_allotment
  (
    land_id,
    project_id,
    project_name,
    file_type,
    file_path,
    dates,
    rera_number,
    document_date,
    direct_customer_name,
    patta_applied_date,
    patta_received_date,
    created_at,
    updated_at,
    deleted_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
`;

  const filesToInsert = [];

  /* ===== TIR REPORT (file-wise dates) ===== */
  tirFiles.forEach((f, i) => {
    filesToInsert.push({
      type: 'TIR_REPORT',
      path: f.filename,
      date: tirDatesArr[i] || tirDatesArr[0] || null,
    });
  });

  /* ===== VALUATION REPORT ===== */
  valuationFiles.forEach((f, i) => {
    filesToInsert.push({
      type: 'VALUATION_REPORT',
      path: f.filename,
      date: valuationDatesArr[i] || valuationDatesArr[0] || null,
    });
  });

  /* ===== ALLOTMENT ATTACHMENT ===== */
  allotmentFiles.forEach((f) => {
    filesToInsert.push({
      type: 'ALLOTMENT_ATTACHMENT',
      path: f.filename,
      date: documentDate,
    });
  });

  /* ===== RELATED PAYMENT ===== */
  relatedPaymentFiles.forEach((f) => {
    filesToInsert.push({
      type: 'RELATED_PAYMENT',
      path: f.filename,
      date: documentDate,
    });
  });

  /* ===== PLOT PATTA ===== */
  pattaFiles.forEach((f) => {
    filesToInsert.push({
      type: 'PLOT_PATTA_ATTACHMENT',
      path: f.filename,
      date: documentDate,
    });
  });

  /* ===== NO FILES BUT DATA PRESENT ===== */
  if (
    filesToInsert.length === 0 &&
    (reraNumber ||
      documentDate ||
      pattaAppliedDate ||
      pattaReceivedDate ||
      allotment_direct_customer||
    reraProjectName   )
    
  ) {
    filesToInsert.push({
      type: null,
      path: null,
      date: documentDate,
    });
  }

  /* ===== INSERT ===== */
  for (const row of filesToInsert) {
    const result = await connection.insertQuery(reraInsertQuery, [
      landId,
      reraProjectId,
  reraProjectName,
      row.type,
      row.path,
      row.date,               // ✅ FILE-WISE DATE
      reraNumber,
      documentDate,
      directCustomer,
      pattaAppliedDate,
      pattaReceivedDate,
      formattedDateTime,
      formattedDateTime,
    ]);

    if (!reraAllotmentId) {
      reraAllotmentId = result.insertId;
    }
  }

  console.log(
    '✅ RERA allotment rows inserted:',
    filesToInsert.length,
    'first ID:',
    reraAllotmentId
  );
}

        // ========== 4) LAND ATTACHMENTS INSERT (type-wise dates) ==========
        let totalFilesInserted = 0;

  if (landId && req.files) {
  const attachmentInsertQuery = `
    INSERT INTO land_attachments
    (land_id, type, file_path, upload_at, dates, is_deleted)
    VALUES (?, ?, ?, ?, ?, 0)
  `;

  // 🔹 LAND CHAIN DOCS
  (req.files.land_chain_docs || []).forEach((file, index) => {
    const date =
      chainDates[index] && String(chainDates[index]).trim()
        ? chainDates[index]
        : todayDate;

    connection.insertQuery(attachmentInsertQuery, [
      landId,
      'Land_Chain_Documents',
      file.filename,
      formattedDateTime,
      date,
    ]);
  });

  // 🔹 MAP MASTER PLAN
  (req.files.map_file || []).forEach((file, index) => {
    const date =
      mapDates[index] && String(mapDates[index]).trim()
        ? mapDates[index]
        : todayDate;

    connection.insertQuery(attachmentInsertQuery, [
      landId,
      'Map_Master_Plan',
      file.filename,
      formattedDateTime,
      date,
    ]);
  });

  // 🔹 POA / MUTATION DOCS
  (req.files.poa_doc || []).forEach((file, index) => {
    const date =
      poaDates[index] && String(poaDates[index]).trim()
        ? poaDates[index]
        : todayDate;

    connection.insertQuery(attachmentInsertQuery, [
      landId,
      'POA_Document',
      file.filename,
      formattedDateTime,
      date,
    ]);
  });

  console.log('✅ Land attachments inserted with per-file dates');
}


        // ========== RESPONSE ==========
        return res.json({
          success: true,
          message:
            'Seller(s), Seller KYC, Buyer(s), Land, Conversion, RERA and Attachments saved successfully',
          data: {
            seller_id: sellerId,        // primary
            seller_ids: sellerIds,      // ALL sellers
            seller_kyc_id: sellerKycId,
            buyer_id: buyerId,          // ho sakta hai null ho agar koi buyer nahi tha / sab skip ho gaye
            buyer_ids: buyerIds,        // [] ho sakta hai
            land_id: landId,
            properties_payment_id: propertiesPaymentId,
            conversion_id: conversionId,
            conversion_attachments_count: conversionAttachmentsCount,
            rera_allotment_id: reraAllotmentId,
            land_attachments_count: totalFilesInserted,
          },
        });
      } catch (error) {
        console.error('Database error in Propertiesadd:', error);
        return res.status(500).json({
          success: false,
          message: error.message, 
        });
      }
    });
  };








exports.PropertiesUpdate = async (req, res) => {
  upload(req, res, async (err) => {
  if (err) {
    throw err;
  }
    try {
      const dbConn = db;

      /* ================= HELPERS ================= */
      /* ================= DIRECT CUSTOMER NORMALIZER ================= */
const mapDirectCustomer = (v) => {
  if (v === undefined || v === null || v === "") return 2;

  const val = String(v).trim().toLowerCase();

  if (val === "yes" || val === "1" || val === "true") return 1;
  if (val === "no"  || val === "0" || val === "false") return 0;

  return 2; // fallback
};


      const safeStr = (v) =>
        v === undefined || v === null || typeof v === "object" ||
        String(v).toLowerCase() === "null"
          ? null
          : String(v).trim();

           const safeNumber = (v) => {
        if (v === undefined || v === null || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      const parseJsonArray = (v) => {
        try {
          const r = JSON.parse(v);
          return Array.isArray(r) ? r : [];
        } catch {
          return [];
        }
      };

     const parseIdsArray = (v) => {
  if (Array.isArray(v)) {
    return v.map(Number).filter(n => n > 0);
  }

  try {
    return JSON.parse(v).map(Number).filter(n => n > 0);
  } catch {
    return [];
  }
};


      const now = new Date();
      const dateTime = now.toISOString().slice(0, 19).replace("T", " ");

      /* ================= BODY ================= */
      const {
        land_id,
        sellers,
        buyers,
        buyer_delete_ids,
        seller_delete_ids ,  
        all_payments,
        payment_delete_ids 
   , 
   conversion_challan_existing,
   land_attachment_delete_ids,
   seller_kyc_delete_ids   ,
   conversion_attachment_delete_ids,
    project_name,
  project_font
      } = req.body;

       console.log(conversion_challan_existing)
       const landsArr = parseJsonArray(req.body.lands);

      if (!land_id) {
  throw new Error("land_id is required");
}

      /* ================= SELLER DELETE (SOFT) ================= */
      const sellerDeleteIds = parseIdsArray(seller_delete_ids);

      if (sellerDeleteIds.length) {
        // 🔹 delete sellers
        await dbConn.fetchQuery(
          `
          UPDATE sellers
          SET deleted_at=?, updated_at=?
          WHERE id IN (${sellerDeleteIds.join(",")})
            AND land_id=?
          `,
          [dateTime, dateTime, land_id]
        );

        // 🔹 delete buyers linked to these sellers
        await dbConn.fetchQuery(
          `
          UPDATE buyers
          SET deleted_at=?, updated_at=?
          WHERE seller_id IN (${sellerDeleteIds.join(",")})
          `,
          [dateTime, dateTime]
        );
      }

      /* ================= SELLERS (UPSERT) ================= */
      const sellersArr = parseJsonArray(sellers);

      if (!sellersArr.length) {
        return res.status(400).json({
          success: false,
          message: "At least one seller required"
        });
      }

      for (const s of sellersArr) {
        const isCompany =
          String(s.type || "seller").toLowerCase() === "holder";

        if (s.id) {
          // 🔹 UPDATE
          await dbConn.fetchQuery(
            `
            UPDATE sellers SET
              name=?, relation_type=?, relation_name=?, age=?, address=?, mobile=?,
              aadhaar=?, pan_no=?, area=?, area_type=?,
              mutation_status=?, jamabandi_status=?, girdawari_status=?,
              party_type=?, poa_holder_name=?, remarks=?, font_name=?, updated_at=?
            WHERE id=? AND land_id=? AND deleted_at IS NULL
            `,
            [
              safeStr(s.seller_name),
              isCompany ? "DIRECTOR" : safeStr(s.relation),
              isCompany ? safeStr(s.director_name) : safeStr(s.fatherName),
              safeNumber (s.age),
              safeStr(s.address),
              safeStr(s.mobile),
              safeStr(s.aadhaar),
              safeStr(s.pan),
              safeNumber (s.area),
              safeStr(s.area_type),
              safeStr(s.mutation_status),
              safeStr(s.jamabandi_status),
              safeStr(s.girdawari_status),
              isCompany ? "company" : "seller",
              safeStr(s.poa_holder_name),
              safeStr(s.seller_remarks),
              Number(s.font_name || 0),
              dateTime,
              s.id,
              land_id
            ]
          );
        } else {
          // 🔹 INSERT
          await dbConn.fetchQuery(
            `
            INSERT INTO sellers
            (land_id, name, relation_type, relation_name, age, address, mobile,
             aadhaar, pan_no, area, area_type,
             mutation_status, jamabandi_status, girdawari_status,
             party_type, poa_holder_name, remarks, font_name,
             created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              land_id,
              safeStr(s.seller_name),
              isCompany ? "DIRECTOR" : safeStr(s.relation),
              isCompany ? safeStr(s.director_name) : safeStr(s.fatherName),
            safeNumber (s.age),
              safeStr(s.address),
              safeStr(s.mobile),
              safeStr(s.aadhaar),
              safeStr(s.pan),
              safeNumber (s.area),
              safeStr(s.area_type),
              safeStr(s.mutation_status),
              safeStr(s.jamabandi_status),
              safeStr(s.girdawari_status),
              isCompany ? "company" : "seller",
              safeStr(s.poa_holder_name),
              safeStr(s.seller_remarks),
              Number(s.font_name || 0),
              dateTime,
              dateTime
            ]
          );
        }
      }

    /* ================= BUYERS (UPSERT) ================= */
const buyersArr = parseJsonArray(buyers);
const buyerDeleteIds = parseIdsArray(buyer_delete_ids);
const safeDate = (v) =>
  v && String(v).trim() !== "" ? String(v).trim() : null;
for (const b of buyersArr) {

  /* 🔹 UPDATE BUYER */
  if (b.id) {
    await dbConn.fetchQuery(
      `
      UPDATE buyers SET
        name=?, mobile_number=?, address=?, aadhar_number=?, pan_number=?,
        relation_prefix=?, age=?, prefix_name=?, reference=?,
        area=?, area_type=?, mutation_status=?, jamabandi_status=?,
        girdawari_status=?, party_type=?, updated_at=?
      WHERE id=? AND deleted_at IS NULL
      `,
      [
        safeStr(b.name),
        safeStr(b.mobile),
        safeStr(b.address),
        safeStr(b.aadhaar),
        safeStr(b.pan),
        safeStr(b.relation),
        safeStr(b.age),
        safeStr(b.fatherName),
        safeStr(b.reference),
        safeStr(b.area),
        safeStr(b.area_type),
        safeStr(b.mutation_status),
        safeStr(b.jamabandi_status),
        safeStr(b.girdawari_status),
        b.type === "company" ? "company" : "buyer",
        dateTime,
        b.id
      ]
    );
  }

  /* 🔹 INSERT BUYER (id = null) */
  else {
    await dbConn.fetchQuery(
      `
      INSERT INTO buyers
      (
        seller_id,
        name, mobile_number, address,
        aadhar_number, pan_number,
        relation_prefix, age, prefix_name, reference,
        area, area_type,
        mutation_status, jamabandi_status, girdawari_status,
        party_type,
        created_at, updated_at
      )
      VALUES (
        (SELECT id FROM sellers WHERE land_id=? AND deleted_at IS NULL LIMIT 1),
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
      )
      `,
      [
        land_id,
        safeStr(b.name),
        safeStr(b.mobile),
        safeStr(b.address),
        safeStr(b.aadhaar),
        safeStr(b.pan),
        safeStr(b.relation),
        safeStr(b.age),
        safeStr(b.fatherName),
        safeStr(b.reference),
        safeStr(b.area),
        safeStr(b.area_type),
        safeStr(b.mutation_status),
        safeStr(b.jamabandi_status),
        safeStr(b.girdawari_status),
        b.type === "company" ? "company" : "buyer",
        dateTime,
        dateTime
      ]
    );
  }
}

/* 🔹 DELETE BUYERS */
if (buyerDeleteIds.length) {
  await dbConn.fetchQuery(
    `
    UPDATE buyers
    SET deleted_at=?, updated_at=?
    WHERE id IN (${buyerDeleteIds.join(",")})
    `,
    [dateTime, dateTime]
  );
}


/* ================= LAND UPDATE ================= */
// await dbConn.fetchQuery(
//   `
//   UPDATE land SET
//     land_area_type=?,
//     land_area=?,
//     upni_no_or_chak_no=?,
//     upni_type=?,
//     rajaswa_no=?,
//     murbba_no=?,
//     kila_no=?,
//     murbba_type=?,
//     mutation_status=?,
//     jamabandi_status=?,
//     girdawari_status=?,
//     payable_amount=?,
//     remarks=?,
//     updated_at=?
//   WHERE id=? AND deleted_at IS NULL
//   `,
//   [
//     safeStr(req.body.land_area_type),
//     safeNumber(req.body.land_area),
//     safeStr(req.body.upni_no_or_chak_no),
//     safeStr(req.body.upni_type),
//     safeStr(req.body.rajaswa_no),
//     safeStr(req.body.murbba_no),
//     safeStr(req.body.kila_no),
//     safeStr(req.body.murbba_type),
//     safeStr(req.body.mutation_status),
//     safeStr(req.body.jamabandi_status),
//     safeStr(req.body.girdawari_status),
//     safeNumber(req.body.payable_amount),
//     safeStr(req.body.land_remarks),
//     dateTime,
//     land_id
//   ]
// );

/* ================= LAND UPDATE (ARRAY BASED – FINAL FIX) ================= */

if (!landsArr.length) {
  throw new Error("lands array is required for update");
}

for (const land of landsArr) {
  if (!land.id) continue; // safety

  await dbConn.fetchQuery(
    `
    UPDATE land SET
      land_area_type=?,
      land_area=?,
      upni_no_or_chak_no=?,
      upni_type=?,
      rajaswa_no=?,
      murbba_no=?,
      kila_no=?,
      murbba_type=?,
      mutation_status=?,
      jamabandi_status=?,
      girdawari_status=?,
      payable_amount=?,
      remarks=?,
      is_married=?,
      is_married_land_id=?,
      updated_at=?
    WHERE id=?
    `,
    [
      safeStr(land.land_area_type),
      safeNumber(land.land_area),
      safeStr(land.upni_no_or_chak_no),
      safeStr(land.upni_type),
      safeStr(land.rajaswa_no),
      safeStr(land.murbba_no),
      safeStr(land.kila_no),
      safeStr(land.murbba_type),
      safeStr(land.mutation_status),
      safeStr(land.jamabandi_status),
      safeStr(land.girdawari_status),
      safeNumber(land.payable_amount),
      safeStr(land.remarks),
      safeNumber(land.is_married),
      safeNumber(land.is_married_land_id),
      dateTime,
      land.id
    ]
  );
}




/* ================= LAND ATTACHMENTS DELETE ================= */
/* ================= PARSE EXISTING PAYLOAD ================= */
let landExisting = {};
try {
  landExisting = JSON.parse(req.body.land_attachments_existing || "{}");
} catch {
  landExisting = {};
}

/* ================= ONLY DATE UPDATE (NO FILE CHANGE) ================= */
const updateOnlyDate = async (items = []) => {
  for (const item of items) {
    if (!item?.id) continue;

    await dbConn.fetchQuery(
      `
      UPDATE land_attachments
      SET dates = ?
      WHERE id = ?
        AND land_id = ?
        AND deleted_at IS NULL
        AND is_deleted = 0
      `,
      [safeStr(item.date), item.id, land_id]
    );
  }
};

// 🔹 date-only updates
await updateOnlyDate(landExisting.land_chain_docs_existing);
await updateOnlyDate(landExisting.map_master_plan_existing);
await updateOnlyDate(landExisting.poa_doc_existing);

/* ================= FILE REPLACE OR INSERT ================= */
const handleReplaceOrInsert = async ({
  files = [],
  dates = [],
  ids = [],
  type
}) => {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const date = dates?.[i] || null;
    const id   = ids?.[i] || null;

    if (id) {
      // 🔁 REPLACE EXISTING FILE
      await dbConn.fetchQuery(
        `
        UPDATE land_attachments
        SET file_path = ?, dates = ?
        WHERE id = ?
          AND land_id = ?
          AND deleted_at IS NULL
          AND is_deleted = 0
        `,
        [file.filename, date, id, land_id]
      );
    } else {
      // ➕ INSERT NEW FILE
      await dbConn.fetchQuery(
        `
        INSERT INTO land_attachments
        (land_id, type, file_path, upload_at, dates, is_deleted)
        VALUES (?, ?, ?, ?, ?, 0)
        `,
        [land_id, type, file.filename, dateTime, date]
      );
    }
  }
};

/* ================= APPLY FILE UPSERT ================= */

// 🔹 POA DOCUMENT
await handleReplaceOrInsert({
  files: req.files?.poa_doc || [],
  dates: req.body.poa_doc_date || [],
  ids: req.body.poa_doc_id || [],
  type: "POA_Document"
});

// 🔹 MAP MASTER PLAN
await handleReplaceOrInsert({
  files: req.files?.map_file || [],
  dates: req.body.map_file_date || [],
  ids: req.body.map_file_id || [],
  type: "Map_Master_Plan"
});

// 🔹 LAND CHAIN DOCUMENTS
await handleReplaceOrInsert({
  files: req.files?.land_chain_docs || [],
  dates: req.body.land_chain_docs_date || [],
  ids: req.body.land_chain_docs_id || [],
  type: "Land_Chain_Documents"
});

/* ================= 🔥 FINAL DELETE (ALWAYS LAST) ================= */


/* ================= LAND ATTACHMENT DELETE (UNCHANGED) ================= */
const deleteLandAttachmentIds = parseIdsArray(land_attachment_delete_ids);

if (deleteLandAttachmentIds.length) {
  await dbConn.fetchQuery(
    `
    UPDATE land_attachments
    SET is_deleted = 1
    WHERE id IN (${deleteLandAttachmentIds.join(",")})
      AND land_id = ?
    `,
    [land_id]
  );
}






/* =========================================================
   CONVERSION + DIVISION (LAND ATTACHMENT STYLE – FINAL)
   ========================================================= */
const deleteConversionAttachmentIds =
  parseIdsArray(conversion_attachment_delete_ids);
/* ---------- helpers ---------- */


const safeVarchar = (v) =>
  v && String(v).trim() !== "" ? String(v).trim() : null;

const safeAuthority = (v) => {
  const allowed = ["BDA", "JDA", "HB", "OTHER"];
  if (!v) return null;
  const val = String(v).toUpperCase();
  return allowed.includes(val) ? val : "OTHER";
};

const normalizeArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return [v];
};

/* ---------- BODY ---------- */
const {
  conversion_application_date,
  conversion_order_date,
  provision_section,
  division_details,
  converted_area,
  conversion_authority,
  conversion_challan_date,
  conversion_map_date,
  conversion_order_date2
} = req.body;

/* ---------- find existing conversion ---------- */
const existingConv = await dbConn.fetchQuery(
  `SELECT id FROM conversion_details WHERE land_id=? AND deleted_at IS NULL LIMIT 1`,
  [land_id]
);

let conversionId = existingConv?.[0]?.id || null;

/* ---------- parse division_details ---------- */
let divisionDetailsObj = {};
try {
  divisionDetailsObj =
    typeof division_details === "string"
      ? JSON.parse(division_details)
      : division_details || {};
} catch {
  divisionDetailsObj = {};
}

const divisionOfAreaStr =
  Object.keys(divisionDetailsObj).length > 0
    ? Object.keys(divisionDetailsObj).join(",")
    : null;

const convertedAreaStr =
  converted_area !== undefined && converted_area !== ""
    ? String(converted_area)
    : null;

/* ---------- check conversion touched ---------- */
const hasConversionData =
  safeDate(conversion_application_date) ||
  safeDate(conversion_order_date || conversion_order_date2) ||
  safeVarchar(provision_section) ||
  divisionOfAreaStr ||
  convertedAreaStr ||
  safeAuthority(conversion_authority);

const hasConversionFiles =
  req.files?.conversion_challan_copy?.length ||
  req.files?.conversion_order_attachment?.length ||
  req.files?.conversion_map_attachment?.length;

/* ---------- UPSERT conversion_details ---------- */
if (hasConversionData || hasConversionFiles) {
  if (conversionId) {
    // 🔁 UPDATE
    await dbConn.fetchQuery(
      `
      UPDATE conversion_details SET
        application_date=?,
        order_date=?,
        provision_section=?,
        division_of_area=?,
        converted_area=?,
        authority=?,
        updated_at=?
      WHERE id=? AND land_id=? AND deleted_at IS NULL
      `,
      [
        safeDate(conversion_application_date),
        safeDate(conversion_order_date || conversion_order_date2),
        safeVarchar(provision_section),
        divisionOfAreaStr,
        convertedAreaStr,
        safeAuthority(conversion_authority),
        dateTime,
        conversionId,
        land_id
      ]
    );
  } else {
    // ➕ INSERT
    const ins = await dbConn.fetchQuery(
      `
      INSERT INTO conversion_details
      (
        land_id,
        application_date,
        order_date,
        provision_section,
        division_of_area,
        converted_area,
        authority,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        land_id,
        safeDate(conversion_application_date),
        safeDate(conversion_order_date || conversion_order_date2),
        safeVarchar(provision_section),
        divisionOfAreaStr,
        convertedAreaStr,
        safeAuthority(conversion_authority),
        dateTime,
        dateTime
      ]
    );
    conversionId = ins.insertId;
  }
}

/* =========================================================
   CONVERSION ATTACHMENTS (EXACT LAND BEHAVIOUR)
   ========================================================= */

if (conversionId) {

  /* ---------- EXISTING PAYLOAD ---------- */
  let conversionExisting = {};
  try {
    conversionExisting = JSON.parse(req.body.conversion_challan_existing || "{}");
  } catch {
    conversionExisting = {};
  }

  /* ---------- DATE ONLY UPDATE ---------- */
  const updateConvOnlyDate = async (items = []) => {
    for (const item of items) {
      if (!item?.id) continue;

      await dbConn.fetchQuery(
        `
        UPDATE conversion_attachments
        SET document_date=?
        WHERE id=? AND conversion_id=? AND deleted_at IS NULL
        `,
        [safeStr(item.date), item.id, conversionId]
      );
    }
  };

  await updateConvOnlyDate(conversionExisting.conversion_challan_existing);
  await updateConvOnlyDate(conversionExisting.conversion_order_existing);
  await updateConvOnlyDate(conversionExisting.conversion_map_existing);

  /* ---------- FILE REPLACE / INSERT ---------- */
  const handleConversionReplaceOrInsert = async ({
    files = [],
    dates = [],
    ids = [],
    type
  }) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const date = dates?.[i] || null;
      const id   = ids?.[i] || null;

      if (id) {
        // 🔁 REPLACE EXISTING (NO updated_at)
        await dbConn.fetchQuery(
          `
          UPDATE conversion_attachments
          SET file_path=?, document_date=?
          WHERE id=? AND conversion_id=? AND deleted_at IS NULL
          `,
          [file.filename, date, id, conversionId]
        );
      } else {
        // ➕ INSERT NEW
        await dbConn.fetchQuery(
          `
          INSERT INTO conversion_attachments
          (
            conversion_id,
            attachment_type,
            file_path,
            uploaded_at,
            document_date
          )
          VALUES (?, ?, ?, ?, ?)
          `,
          [conversionId, type, file.filename, dateTime, date]
        );
      }
    }
  };

  // 🔹 CHALLAN
  await handleConversionReplaceOrInsert({
    files: req.files?.conversion_challan_copy || [],
    dates: req.body.conversion_challan_date || [],
    ids: req.body.conversion_challan_id || [],
    type: "CHALLAN_COPY"
  });

  // 🔹 ORDER
  await handleConversionReplaceOrInsert({
    files: req.files?.conversion_order_attachment || [],
    dates: req.body.conversion_order_date || [],
    ids: req.body.conversion_order_id || [],
    type: "CONVERSION_ORDER"
  });

  // 🔹 MAP
  await handleConversionReplaceOrInsert({
    files: req.files?.conversion_map_attachment || [],
    dates: req.body.conversion_map_date || [],
    ids: req.body.conversion_map_id || [],
    type: "MAP_ATTACHMENT"
  });
}

/* =========================================================
   DIVISION OF AREA (FULL REPLACE – SAFE)
   ========================================================= */

if (conversionId && divisionDetailsObj) {

  await dbConn.fetchQuery(
    `DELETE FROM division_of_area WHERE land_id=?`,
    [land_id]
  );

  const divInsert = `
    INSERT INTO division_of_area
    (land_id, conversion_details_id, type, area, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  for (const [type, area] of Object.entries(divisionDetailsObj)) {
    if (!area || Number(area) === 0) continue;

    await dbConn.fetchQuery(divInsert, [
      land_id,
      conversionId,
      type,
      Number(area),
      dateTime,
      dateTime
    ]);
  }
}
/* =========================================================
   CONVERSION ATTACHMENTS DELETE (LAND STYLE – FINAL)
   ========================================================= */

if (conversionId && deleteConversionAttachmentIds.length) {
  await dbConn.fetchQuery(
    `
    UPDATE conversion_attachments
    SET deleted_at = ?
    WHERE id IN (${deleteConversionAttachmentIds.join(",")})
      AND conversion_id = ?
      AND deleted_at IS NULL
    `,
    [dateTime, conversionId]
  );
}

const conversionDetailsArr = parseJsonArray(req.body.conversion_details);

if (conversionDetailsArr.length) {
  for (const c of conversionDetailsArr) {
    if (!c.id) continue; // safety

    await dbConn.fetchQuery(
      `
      UPDATE conversion_details SET
        application_date = ?,
        order_date = ?,
        provision_section = ?,
        authority = ?,
        updated_at = ?
      WHERE id = ?
        AND land_id = ?
      `,
      [
        safeDate(c.application_date),
        safeDate(c.order_date),
        safeVarchar(c.provision_section),
        safeAuthority(c.authority),
        dateTime,
        c.id,
        land_id
      ]
    );
  }
}


/* ================= KYC DELETE IDS ================= */
/* \================= KYC DELETE IDS ================= */

const deleteKycIds = parseIdsArray(seller_kyc_delete_ids);

/* ================= 🔥 ID NORMALIZER (AS IS) ================= */
const normalizeIds = (ids, filesLen) => {
  if (!ids) return Array(filesLen).fill(null);

  if (!Array.isArray(ids)) {
    const n = Number(ids);
    return [Number.isFinite(n) ? n : null];
  }

  return ids.map(v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });
};

/* ================= 🔥 DATE NORMALIZER (ONLY ADDITION) ================= */
const normalizeDates = (dates, filesLen) => {
  if (!dates) return Array(filesLen).fill(null);
  if (Array.isArray(dates)) return dates;
  return Array(filesLen).fill(dates); // 👈 single date → all files
};

/* ================= KYC UPSERT ================= */
const handleKycReplaceOrInsert = async ({
  files = [],
  dates = [],
  ids,
  seller_id,
  file_type
}) => {
  const alignedIds   = normalizeIds(ids, files.length);
  const alignedDates = normalizeDates(dates, files.length);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const date = alignedDates[i] || null;
    const id   = alignedIds[i];

    if (id) {
      // 🔁 REPLACE
      await dbConn.fetchQuery(
        `
        UPDATE seller_kyc_document
        SET file_path = ?, document_date = ?, updated_at = ?
        WHERE id = ?
          AND seller_id = ?
          AND deleted_at IS NULL
        `,
        [file.filename, date, dateTime, id, seller_id]
      );
    } else {
      // ➕ INSERT
      await dbConn.fetchQuery(
        `
        INSERT INTO seller_kyc_document
        (seller_id,land_id,  file_type, file_path, document_date, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?)
        `,
        [seller_id,land_id, file_type, file.filename, date, dateTime, dateTime]
      );
    }
  }
};

const primarySellerId = sellersArr?.[0]?.id;

/* ========= SELLER AADHAAR ========= */
await handleKycReplaceOrInsert({
  files: req.files?.seller_aadhaar || [],
  dates: req.body.kyc_date || [],
  ids: req.body.seller_aadhaar_id,
  seller_id: primarySellerId,
  file_type: "AADHAAR"
});

/* ========= SELLER PAN ========= */
await handleKycReplaceOrInsert({
  files: req.files?.seller_pan || [],
  dates: req.body.kyc_date || [],
  ids: req.body.seller_pan_id,
  seller_id: primarySellerId,
  file_type: "PAN"
});

/* ========= POA PAN ========= */
await handleKycReplaceOrInsert({
  files: req.files?.seller_poa_pan || [],
  dates: req.body.kyc_date || [],
  ids: req.body.seller_poa_pan_id,
  seller_id: primarySellerId,
  file_type: "POA_PAN"
});

/* ========= RAJASWA KHASRA ========= */
await handleKycReplaceOrInsert({
  files: req.files?.khasra_file || [],
  dates: req.body.rajaswaDocDate || [],
  ids: req.body.rajaswa_khasra_id,
  seller_id: primarySellerId,
  file_type: "KHASRA"
});

/* ========= UPNIVESHAN ========= */
await handleKycReplaceOrInsert({
  files: req.files?.upniveshan_khasra_file || [],
  dates: req.body.upniveshanDocDate || [],
  ids: req.body.upniveshan_khasra_id,
  seller_id: primarySellerId,
  file_type: "UPNIVESHAN_KHASRA"
});

/* ================= FINAL KYC DELETE ================= */
if (deleteKycIds.length) {
  await dbConn.fetchQuery(
    `
    UPDATE seller_kyc_document
    SET deleted_at = ?
    WHERE id IN (${deleteKycIds.join(",")})
    `,
    [dateTime]
  );
}

// ✅ DECIMAL / NUMBER SAFE HANDLER
const safeDecimal = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};



const paymentsArr = parseJsonArray(all_payments);
const paymentDeleteIds = parseIdsArray(payment_delete_ids);



/* ================= PAYMENT AMOUNT VALIDATION (UPDATE) ================= */

// const landTotalRows = await dbConn.fetchQuery(
//   `
//   SELECT SUM(payable_amount) AS total_land_amount
//   FROM land
//   WHERE id = ?
//      OR is_married_land_id = ?
//   `,
//   [land_id, land_id]
// );

// const totalLandAmount = Number(
//   landTotalRows?.[0]?.total_land_amount || 0
// );

// // 2️⃣ UPDATE होने वाले payment IDs
// const updatingPaymentIds = paymentsArr
//   .filter(p => p.id)
//   .map(p => Number(p.id));

// // 3️⃣ OLD payment amount (UPDATE वाले)
// let oldPaymentMap = {};

// if (updatingPaymentIds.length) {
//   const oldRows = await dbConn.fetchQuery(
//     `
//     SELECT id,
//            COALESCE(payment_a,0) +
//            COALESCE(payment_admin_entry,0) AS old_amount
//     FROM properties_payment
//     WHERE id IN (${updatingPaymentIds.join(",")})
//       AND deleted_at IS NULL
//     `
//   );

//   for (const r of oldRows) {
//     oldPaymentMap[r.id] = Number(r.old_amount);
//   }
// }

// // 4️⃣ BASE PAID (excluding updating rows)
// let basePaidQuery = `
//   SELECT COALESCE(
//     SUM(
//       COALESCE(payment_a,0) +
//       COALESCE(payment_admin_entry,0)
//     ),
//     0
//   ) AS base_paid
//   FROM properties_payment
//   WHERE land_id = ?
//     AND deleted_at IS NULL
// `;

// if (updatingPaymentIds.length) {
//   basePaidQuery += ` AND id NOT IN (${updatingPaymentIds.join(",")})`;
// }

// const basePaidRows = await dbConn.fetchQuery(basePaidQuery, [land_id]);
// const basePaid = Number(basePaidRows[0].base_paid);

// // 5️⃣ DELTA amount (NEW + INCREASED UPDATE)
// // 5️⃣ DELTA amount (NEW + UPDATED)
// let deltaAmount = 0;

// for (const p of paymentsArr) {

//   const newAmount =
//     (Number(p.paymentA) || 0) +
//     (Number(p.paymentAdmin) || 0) +
//     (Number(p.considerationAmount) || 0);

//   if (!p.id) {
//     // 🟢 NEW PAYMENT
//     deltaAmount += newAmount;
//   } else {
//     // 🟡 UPDATED PAYMENT
//     const oldAmount = oldPaymentMap[p.id] || 0;
//     if (newAmount > oldAmount) {
//       deltaAmount += (newAmount - oldAmount);
//     }
//   }
// }



// // 6️⃣ FINAL CHECK
// const finalTotal = basePaid + deltaAmount;

// if (finalTotal > totalLandAmount) {
//   return res.status(400).json({
//     success: false,
//     message:
      
//       `कुल भूमि देय राशि (₹${totalLandAmount}) से अधिक नहीं हो सकता`
//   });
// }






for (const p of paymentsArr) {
  const isPrimary = p.isPrimary === true || p.isPrimary === "true";

  if (p.id) {
    // 🔹 UPDATE PAYMENT
    await dbConn.fetchQuery(
      `
      UPDATE properties_payment SET
        physical_possession_status=?,
        payment_a=?,
        consideration_amount=?,
        payment_admin_entry=?,
        compensation_payment=?,
        land_category=?,
        payment_date=?,
        payment_mode=?,
        bank_name=?,
        branch_name=?,
        cheque_no=?,
        updated_at=?
      WHERE id=? AND land_id=? AND deleted_at IS NULL
      `,
      [
        safeStr(p.physicalPossession),
        safeDecimal(p.paymentA),
      safeDecimal(p.considerationAmount),   // ✅ IMPORTANT
        safeDecimal(p.paymentAdmin),
        safeDecimal(p.compensationPayment),
        safeStr(p.category),
        safeDate(p.paymentDate),
        safeStr(p.paymentMode),
        safeStr(p.bankName),
        safeStr(p.branchName),
        safeStr(p.chequeNo),
        dateTime,
        p.id,
        land_id
      ]
    );
  } else {
    // 🔹 INSERT PAYMENT
    await dbConn.fetchQuery(
      `
      INSERT INTO properties_payment
      (
        land_id,
        physical_possession_status,
        payment_a,
        consideration_amount,
        payment_admin_entry,
        compensation_payment,
        land_category,
        payment_date,
        payment_mode,
        bank_name,
        branch_name,
        cheque_no,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        land_id,
        safeStr(p.physicalPossession),
       safeDecimal(p.paymentA),
        safeDecimal(p.considerationAmount),   // ✅ IMPORTANT
        safeStr(p.paymentAdmin),
        safeDecimal(p.compensationPayment), 
        safeStr(p.category),
        safeStr(p.paymentDate),
        safeStr(p.paymentMode),
        safeStr(p.bankName),
        safeStr(p.branchName),
        safeStr(p.chequeNo),
        dateTime,
        dateTime
      ]
    );
  }
  
}
if (paymentDeleteIds.length) {
  await dbConn.fetchQuery(
    `
    UPDATE properties_payment
    SET deleted_at=?, updated_at=?
    WHERE id IN (${paymentDeleteIds.join(",")})
      AND land_id=?
    `,
    [dateTime, dateTime, land_id]
  );
}



/* =========================================================
   RERA & ALLOTMENT (FINAL WORKING BLOCK)
   ========================================================= */

/* ================= RERA LIST (ARRAY OF OBJECTS) ================= */

/* =========================================================
   RERA & ALLOTMENT (LAND ATTACHMENT STYLE – FINAL)
   ========================================================= */

const {
  rera_registration_number,
  rera_document_date,
  patta_applied_date,
  patta_received_date,
  allotment_direct_customer,
  rera_attachment_delete_ids
} = req.body;

 console.log(allotment_direct_customer)
// /* ---------- helpers ---------- */
/* =========================================================
   🔥 PROJECT TYPE RESOLUTION (UPDATE API – FINAL)
   0 = Project | 1 = Allotment | 2 = Registry
   ========================================================= */
const directCustomerValue = mapDirectCustomer(allotment_direct_customer);
let propertyType = 0;

if (allotment_direct_customer !== undefined && allotment_direct_customer !== null) {
  const adc = String(allotment_direct_customer).trim().toLowerCase();

  if (adc === "yes" || adc === "1" || adc === "true") {
    propertyType = 1;
  } else if (adc === "no" || adc === "2" || adc === "false") {
    propertyType = 2;
  }
}

console.log(
  "🧩 UPDATE allotment_direct_customer:",
  allotment_direct_customer,
  "→ project.type:",
  propertyType
);

/* =========================================================
   BASE RERA DATA (UPDATE / INSERT)
   ========================================================= */
/* =========================================================
   🔥 PROJECT TYPE UPDATE (FROM LAND)
   ========================================================= */

// const projectRow = await dbConn.fetchQuery(
//   `
//   SELECT project_id
//   FROM rera_allotment
//   WHERE land_id = ?
//     AND deleted_at IS NULL
//     AND project_id IS NOT NULL
//   LIMIT 1
//   `,
//   [land_id]
// );

// const projectId = projectRow?.[0]?.project_id || null;

// if (projectId !== null) {
//   await dbConn.fetchQuery(
//     `
//     UPDATE projects
//     SET
//       type = ?,
//       name = ?,
//       krutiDev_font = ?,
//       update_at = ?
//     WHERE project_id = ? AND is_delete = 0
//     `,
//     [
//       propertyType,
//       safeStr(project_name),      // ✅ PROJECT NAME UPDATE
//       Number(project_font || 0),  // ✅ FONT (optional)
//       dateTime,
//       projectId
//     ]
//   );

//   console.log(
//     "✅ Project updated:",
//     projectId,
//     "type:", propertyType,
//     "name:", project_name
//   );
// }

/* =========================================================
   🔥 PROJECT / RERA DECISION BLOCK (FINAL FIX)
   ========================================================= */

/* =========================================================
   🔥 PROJECT / RERA DECISION BLOCK (FINAL FIX)
   ========================================================= */

const isAdcEmpty =
  allotment_direct_customer === undefined ||
  allotment_direct_customer === null ||
  String(allotment_direct_customer).trim() === "";

/* =========================
   CASE 1️⃣ : EMPTY / NULL
   ========================= */
if (isAdcEmpty) {

  // ❌ projects table ko touch nahi karna
  if (project_name && project_name.trim() !== "") {

    const reraRow = await dbConn.fetchQuery(
      `
      SELECT id
      FROM rera_allotment
      WHERE land_id = ?
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [land_id]
    );

    if (reraRow.length) {
      // 🔁 UPDATE ONLY rera_allotment
      await dbConn.fetchQuery(
        `
        UPDATE rera_allotment
        SET project_name = ?, updated_at = ?
        WHERE land_id = ?
          AND deleted_at IS NULL
        `,
        [project_name.trim(), dateTime, land_id]
      );
    } else {
      // ➕ INSERT ONLY rera_allotment
      await dbConn.fetchQuery(
        `
        INSERT INTO rera_allotment
        (land_id, project_name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        `,
        [land_id, project_name.trim(), dateTime, dateTime]
      );
    }
  }

}

/* =========================
   CASE 2️⃣ : YES / NO
   ========================= */
else {

  const projectRow = await dbConn.fetchQuery(
    `
    SELECT project_id
    FROM rera_allotment
    WHERE land_id = ?
      AND deleted_at IS NULL
      AND project_id IS NOT NULL
    LIMIT 1
    `,
    [land_id]
  );

  const projectId = projectRow?.[0]?.project_id || null;

  if (projectId) {
    // 🔁 UPDATE existing project
    await dbConn.fetchQuery(
      `
      UPDATE projects
      SET
        type = ?,
        name = ?,
        krutiDev_font = ?,
        update_at = ?
      WHERE project_id = ?
        AND is_delete = 0
      `,
      [
        propertyType,
        safeStr(project_name),
        Number(project_font || 0),
        dateTime,
        projectId
      ]
    );

  } else if (project_name && project_name.trim() !== "") {
    // 🆕 CREATE project (IMPORTANT FIX)

    const ins = await dbConn.fetchQuery(
      `
      INSERT INTO projects
      (name, krutiDev_font, type, create_at, update_at, is_delete)
      VALUES (?, ?, ?, ?, ?, 0)
      `,
      [
        project_name.trim(),
        Number(project_font || 0),
        propertyType,
        dateTime,
        dateTime
      ]
    );

    const newProjectId = ins.insertId;

    // 🔗 LINK with rera_allotment
    await dbConn.fetchQuery(
      `
      UPDATE rera_allotment
      SET
        project_id = ?,
        project_name = ?,
        updated_at = ?
      WHERE land_id = ?
        AND deleted_at IS NULL
      `,
      [newProjectId, project_name.trim(), dateTime, land_id]
    );
  }
}

const hasReraData =
  safeVarchar(rera_registration_number) ||
  safeDate(rera_document_date) ||
  safeDate(patta_applied_date) ||
  safeDate(patta_received_date) ||
   allotment_direct_customer !== undefined ||
  req.files?.tir_report_file?.length ||
  req.files?.valuation_report_file?.length ||
  req.files?.allotment_attachment?.length ||
  req.files?.related_payment?.length ||
  req.files?.plot_patta_attachment?.length;

/* 🔹 UPDATE base RERA fields for ALL rows of this land */
if (hasReraData) {
  await dbConn.fetchQuery(
  `
  UPDATE rera_allotment SET
    rera_number=?,
    document_date=?,
    direct_customer_name=?,
    patta_applied_date=?,
    patta_received_date=?,
    updated_at=?
  WHERE land_id=? AND deleted_at IS NULL
  `,
  [
    safeVarchar(rera_registration_number),
    safeDate(rera_document_date),
    directCustomerValue,          // ✅ FIXED
    safeDate(patta_applied_date),
    safeDate(patta_received_date),
    dateTime,
    land_id
  ]
);

}

/* =========================================================
   PARSE EXISTING RERA PAYLOAD (FROM FRONTEND)
   ========================================================= */

let reraExisting = {};
try {
  reraExisting = JSON.parse(req.body.rera_attachments_existing || "{}");
} catch {
  reraExisting = {};
}

/* =========================================================
   DATE ONLY UPDATE (NO FILE CHANGE)
   ========================================================= */

const updateReraOnlyDate = async (items = []) => {
  for (const item of items) {
    if (!item?.id) continue;

    await dbConn.fetchQuery(
      `
      UPDATE rera_allotment
      SET dates=?, updated_at=?
      WHERE id=? AND land_id=? AND deleted_at IS NULL
      `,
      [safeDate(item.date), dateTime, item.id, land_id]
    );
  }
};

await updateReraOnlyDate(reraExisting.tir_report_existing);
await updateReraOnlyDate(reraExisting.valuation_report_existing);
await updateReraOnlyDate(reraExisting.allotment_existing);
await updateReraOnlyDate(reraExisting.related_payment_existing);
await updateReraOnlyDate(reraExisting.plot_patta_existing);

/* =========================================================
   FILE REPLACE OR INSERT (🔥 MAIN FIX)
   ========================================================= */

const handleReraReplaceOrInsert = async ({
  files = [],
  dates = [],
  ids = [],
  type
}) => {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const date = dates?.[i] || null;
    const id   = ids?.[i] || null;

    if (id) {
      // 🔁 REPLACE EXISTING FILE
      await dbConn.fetchQuery(
        `
        UPDATE rera_allotment
        SET file_path=?, dates=?, updated_at=?
        WHERE id=? AND land_id=? AND deleted_at IS NULL
        `,
        [file.filename, date, dateTime, id, land_id]
      );
    } else {
      // ➕ INSERT NEW FILE
      await dbConn.fetchQuery(
        `
        INSERT INTO rera_allotment
        (
          land_id,
          file_type,
          file_path,
          dates,
          rera_number,
          document_date,
          direct_customer_name,
          patta_applied_date,
          patta_received_date,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          land_id,
          type,
          file.filename,
          date,
          safeVarchar(rera_registration_number),
          safeDate(rera_document_date),
             directCustomerValue,
          safeDate(patta_applied_date),
          safeDate(patta_received_date),
          dateTime,
          dateTime
        ]
      );
    }
  }
};

/* =========================================================
   APPLY FILE UPSERT (SAME AS LAND)
   ========================================================= */

await handleReraReplaceOrInsert({
  files: req.files?.tir_report_file || [],
  dates: req.body.tir_report_date || [],
  ids: req.body.tir_report_id || [],
  type: "TIR_REPORT"
});

await handleReraReplaceOrInsert({
  files: req.files?.valuation_report_file || [],
  dates: req.body.valuation_report_date || [],
  ids: req.body.valuation_report_id || [],
  type: "VALUATION_REPORT"
});

await handleReraReplaceOrInsert({
  files: req.files?.allotment_attachment || [],
  dates: req.body.allotment_date || [],
  ids: req.body.allotment_id || [],
  type: "ALLOTMENT_ATTACHMENT"
});

await handleReraReplaceOrInsert({
  files: req.files?.related_payment || [],
  dates: req.body.rera_payment_date || [],
  ids: req.body.related_payment_id || [],
  type: "RELATED_PAYMENT"
});

await handleReraReplaceOrInsert({
  files: req.files?.plot_patta_attachment || [],
  dates: req.body.plot_patta_date || [],
  ids: req.body.plot_patta_id || [],
  type: "PLOT_PATTA_ATTACHMENT"
});

/* =========================================================
   RERA FILE DELETE (SOFT DELETE)
   ========================================================= */

const deleteReraIds = parseIdsArray(rera_attachment_delete_ids);

if (deleteReraIds.length) {
  await dbConn.fetchQuery(
    `
    UPDATE rera_allotment
    SET deleted_at=?, updated_at=?
    WHERE id IN (${deleteReraIds.join(",")})
      AND land_id=?
      AND deleted_at IS NULL
    `,
    [dateTime, dateTime, land_id]
  );
}

/* ================= END RERA & ALLOTMENT ================= */

const reraListArr = parseJsonArray(req.body.rera_list);

if (reraListArr.length) {
  for (const r of reraListArr) {

    const reraNumber = safeVarchar(r.rera_number);
    const docDate    = safeDate(r.document_date);

    if (!reraNumber && !docDate) continue;

    if (r.id) {
      // ✅ UPDATE (ID exists)
      await dbConn.fetchQuery(
        `
        UPDATE rera_allotment
        SET rera_number=?, document_date=?, updated_at=?
        WHERE id=? AND land_id=? AND deleted_at IS NULL
        `,
        [reraNumber, docDate, dateTime, r.id, land_id]
      );
    } else {
      // ✅ INSERT (ID null)
      await dbConn.fetchQuery(
        `
        INSERT INTO rera_allotment
        (land_id, rera_number, document_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        `,
        [land_id, reraNumber, docDate, dateTime, dateTime]
      );
    }
  }
}

/* ================= END RERA & ALLOTMENT ================= */



      return res.json({
        success: true,
        message: "Property updated successfully",
        data: { land_id }
      });

    } catch (error) {
      console.error("❌ PropertiesUpdate Error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Database error"
      });
    }
  });
};






exports.PropertiesList = async (req, res) => {
  try {
    const { type, page = 1, limit = 3, search } = req.query;

const currentPage = Math.max(Number(page), 1);
const perPage = Math.max(Number(limit), 1);
const offset = (currentPage - 1) * perPage;
 // 🔥 1 = Allotment, 2 = Registry, all/undefined = All

    const listToSQL = (arr) =>
      Array.isArray(arr) && arr.length ? arr.join(",") : "NULL";

    // 🔥 ONLY ADD: helper for 2 decimal (amount + area)
    const format2Decimal = (val) => {
      if (val === null || val === undefined || val === "") return val;
      return Number(val).toFixed(2);
    };

    const sumDecimal = (arr, key) =>
  arr.reduce((sum, i) => {
    const v = parseFloat(i?.[key]);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);


  let whereClause = `
  (deleted_at IS NULL OR deleted_at = '0000-00-00 00:00:00')
`;

let params = [];

if (search) {
  whereClause += ` AND (
    land_name LIKE ?
    OR khasra_number LIKE ?
  )`;
  params.push(`%${search}%`, `%${search}%`);
}

const countRow = await db.fetchQuery(
  `SELECT COUNT(*) AS total FROM land WHERE ${whereClause}`,
  params
);

const total_records = countRow[0]?.total || 0;



  
    /* ================= 1) LAND ================= */
    // const landRows = await db.fetchQuery(
    //   `SELECT * FROM land
    //    WHERE (deleted_at IS NULL OR deleted_at = '0000-00-00 00:00:00')
    //    ORDER BY id DESC`,
    //   []
    // );

    const landRows = await db.fetchQuery(
  `SELECT * FROM land
   WHERE ${whereClause}
   ORDER BY id DESC
   LIMIT ? OFFSET ?`,
  [...params, perPage, offset]
);


   if (!landRows.length) {
  return res.json({
    success: true,
    message: "No properties found",
    total_records,
    current_page: currentPage,
    total_pages: Math.ceil(total_records / perPage),
    data: []
  });
}


    const landIds = landRows.map((l) => l.id);
    // 🔥 Target land IDs (parent lands)
const targetLandIds = landRows.map((l) => l.id);


    /* ================= 2) SELLERS ================= */
    const sellers = await db.fetchQuery(
      `SELECT * FROM sellers
       WHERE land_id IN (${listToSQL(landIds)})
       AND deleted_at IS NULL`,
      []
    );

    const sellerMap = {};
    sellers.forEach((s) => {
      if (!sellerMap[s.land_id]) sellerMap[s.land_id] = [];
      sellerMap[s.land_id].push(s);
    });

    const sellerIds = sellers.map((s) => s.id);

    /* ================= 3) BUYERS ================= */
    const buyers = sellerIds.length
      ? await db.fetchQuery(
          `SELECT * FROM buyers
           WHERE seller_id IN (${listToSQL(sellerIds)})
           AND deleted_at IS NULL`,
          []
        )
      : [];

    const landBuyerMap = {};
    buyers.forEach((b) => {
      const seller = sellers.find((s) => s.id === b.seller_id);
      if (!seller) return;
      if (!landBuyerMap[seller.land_id]) landBuyerMap[seller.land_id] = [];
      landBuyerMap[seller.land_id].push(b);
    });

    /* ================= 4) SELLER KYC ================= */
    const kycs = sellerIds.length
      ? await db.fetchQuery(
          `SELECT * FROM seller_kyc_document
           WHERE seller_id IN (${listToSQL(sellerIds)})
           AND deleted_at IS NULL`,
          []
        )
      : [];

    const kycMap = {};
    kycs.forEach((row) => {
      if (!kycMap[row.seller_id]) {
        kycMap[row.seller_id] = {
          id: row.id,
          verified_status: row.verified_status,
          pan_files: [],
          aadhaar_files: [],
          poa_pan_files: [],
          khasra_files: [],
          upniveshan_khasra_files: [],
        };
      }

      if (!row.file_path) return;

      const fileObj = {
        id: row.id,
        file: row.file_path,
        date: row.document_date,
      };

      const k = kycMap[row.seller_id];
      switch (row.file_type) {
        case "PAN": k.pan_files.push(fileObj); break;
        case "AADHAAR": k.aadhaar_files.push(fileObj); break;
        case "POA_PAN": k.poa_pan_files.push(fileObj); break;
        case "KHASRA": k.khasra_files.push(fileObj); break;
        case "UPNIVESHAN_KHASRA": k.upniveshan_khasra_files.push(fileObj); break;
      }
    });

    /* ================= 5) PAYMENTS ================= */
    const payments = await db.fetchQuery(
      `SELECT * FROM properties_payment
       WHERE land_id IN (${listToSQL(landIds)})
       AND deleted_at IS NULL`,
      []
    );

    const paymentMap = {};
    payments.forEach((p) => {
      if (!paymentMap[p.land_id]) paymentMap[p.land_id] = [];
      paymentMap[p.land_id].push(p);
    });

   
    const conversions = await db.fetchQuery(
  `SELECT * FROM conversion_details
   WHERE land_id IN (${listToSQL(landIds)})`,
  []
);

   const conversionMap = {};
conversions.forEach((c) => {
  if (!conversionMap[c.land_id]) {
    conversionMap[c.land_id] = [];
  }
  conversionMap[c.land_id].push(c);
});


    const conversionIds = conversions.map((c) => c.id);

    /* ================= 6.1) DIVISION ================= */
    const divisionRows = conversionIds.length
      ? await db.fetchQuery(
          `SELECT conversion_details_id, type, area
           FROM division_of_area
           WHERE conversion_details_id IN (${listToSQL(conversionIds)})`,
          []
        )
      : [];

    const divisionMap = {};
    divisionRows.forEach((row) => {
      if (!divisionMap[row.conversion_details_id]) {
        divisionMap[row.conversion_details_id] = {};
      }
      divisionMap[row.conversion_details_id][row.type] =
        format2Decimal(row.area); // 🔥 FIX
    });

    /* ================= 6.2) CONVERSION ATTACHMENTS ================= */
    const conversionAttachMap = {};
    if (conversionIds.length) {
      const atts = await db.fetchQuery(
        `SELECT * FROM conversion_attachments
         WHERE conversion_id IN (${listToSQL(conversionIds)})
         AND deleted_at IS NULL`,
        []
      );

      atts.forEach((a) => {
        if (!conversionAttachMap[a.conversion_id]) {
          conversionAttachMap[a.conversion_id] = [];
        }
        conversionAttachMap[a.conversion_id].push(a);
      });
    }

/* ================= 7) RERA ================= */
const reras = await db.fetchQuery(
  `SELECT * FROM rera_allotment
   WHERE land_id IN (${listToSQL(landIds)})
   AND deleted_at IS NULL
   ORDER BY id ASC`,
  []
);

const reraMap = {};
reras.forEach((r) => {
  if (!reraMap[r.land_id]) {
    reraMap[r.land_id] = {
      list: [], // 🔥 NEW (array of pairs)
      direct_customer_name: r.direct_customer_name,
      patta_applied_date: r.patta_applied_date,
      patta_received_date: r.patta_received_date,
      attachments: {
        TIR_REPORT: [],
        VALUATION_REPORT: [],
        ALLOTMENT_ATTACHMENT: [],
        RELATED_PAYMENT: [],
        PLOT_PATTA_ATTACHMENT: [],
      },
    };
  }

  // ✅ RERA NUMBER + DATE AS ONE OBJECT (PAIR)
const dateOnly = r.document_date
  ? r.document_date.toISOString().slice(0, 10)
  : null;

const exists = reraMap[r.land_id].list.some(
  (x) =>
    x.rera_number === r.rera_number &&
    x.document_date === dateOnly
);

if (r.rera_number && !exists) {
  reraMap[r.land_id].list.push({
    id: r.id, 
    rera_number: r.rera_number,
    document_date: dateOnly,
  });
}


  // ✅ Attachments SAME as before
  if (r.file_type && r.file_path) {
    reraMap[r.land_id].attachments[r.file_type].push({
      id: r.id,
      file: r.file_path,
      date: r.dates || null,
    });
  }
});

/* ================= 🔥 MERGED LANDS ================= */
const mergedLandRows = await db.fetchQuery(
  `SELECT *
   FROM land
   WHERE is_married = 1
     AND is_married_land_id IN (${listToSQL(targetLandIds)})`,
  []
);


const mergedLandMap = {};
mergedLandRows.forEach((l) => {
  if (!mergedLandMap[l.is_married_land_id]) {
    mergedLandMap[l.is_married_land_id] = [];
  }
  mergedLandMap[l.is_married_land_id].push({
    ...l,
    land_area: format2Decimal(l.land_area),
  });
});


    
const projectIdMap = {};
const projectNameMap = {};

reras.forEach((r) => {
  if (!projectIdMap[r.land_id]) {
    projectIdMap[r.land_id] = r.project_id || null;
    projectNameMap[r.land_id] = r.project_name || null;
  }
});
/* ================= 🔥 PROJECT TYPE MAP (FROM PROJECTS ONLY) ================= */
let projectTypeMap = {};

if (reras.length) {
  const typeRows = await db.fetchQuery(
    `
    SELECT ra.land_id, p.type
    FROM rera_allotment ra
    JOIN projects p ON p.project_id = ra.project_id
    WHERE ra.land_id IN (${listToSQL(reras.map(r => r.land_id))})
      AND p.is_delete = 0
    `,
    []
  );

  typeRows.forEach((r) => {
    projectTypeMap[r.land_id] = Number(r.type);
  });
}

    /* ================= 🔥 FILTER LAND BY TYPE ================= */
    let filteredLandRows = landRows;

    if (type !== undefined && type !== null && type !== "all") {
      const t = Number(type);
      filteredLandRows = landRows.filter(
        (l) => projectTypeMap[l.id] === t
      );
    }

    /* ================= 8) LAND ATTACHMENTS ================= */
    const landAttachments = await db.fetchQuery(
      `SELECT * FROM land_attachments
       WHERE land_id IN (${listToSQL(landIds)})
       AND is_deleted = 0`,
      []
    );

    const landAttachMap = {};
    landAttachments.forEach((a) => {
      if (!landAttachMap[a.land_id]) landAttachMap[a.land_id] = [];
      landAttachMap[a.land_id].push(a);
    });

    /* ================= 🔥 LAND KYC MAP ================= */
const landKycMap = {};

Object.keys(kycMap).forEach((sellerId) => {
  const seller = sellers.find(s => s.id === Number(sellerId));
  if (!seller) return;

  const landId = seller.land_id;

  if (!landKycMap[landId]) {
    landKycMap[landId] = [];
  }

  landKycMap[landId].push({
    seller_id: seller.id,
    ...kycMap[sellerId],
  });
});


    /* ================= 9) FINAL MERGE ================= */
    const data = filteredLandRows.map((land) => {
      const landSellers = sellerMap[land.id] || [];
      const convList = conversionMap[land.id] || [];



      let conversion = null;

if (convList.length) {
  const master =
    convList.find(c => c.deleted_at === null) || convList[0];

  conversion = {
    id: master.id,
    land_id: master.land_id,
    division_of_area: master.division_of_area,
    converted_area: master.converted_area,
    created_at: master.created_at,
    updated_at: master.updated_at,
    deleted_at: master.deleted_at,
    division_details: divisionMap[master.id] || {},

    conversion_details: convList.map(c => ({
      id: c.id,
      provision_section: c.provision_section,
      authority: c.authority,
      application_date: c.application_date,
      order_date: c.order_date,
    }))
  };
}





return {
  land: {
    ...land,
    land_area: format2Decimal(land.land_area),
  },

  // 🔥 यही main logic है
  merged_lands: [
    // ✅ parent land (khud)
    {
      id: land.id,
      note: "parent_land",
      is_married: land.is_married,
      is_married_land_id: land.is_married_land_id,
      deleted_at: land.deleted_at,
    },

    // ✅ merged lands (children)
    ...(mergedLandMap[land.id] || []).map((ml) => ({
      ...ml,
      note: "merged_land",
    })),
  ],
  project_id: projectIdMap[land.id] || null,
  project_name: projectNameMap[land.id] || null,
   project_created: !!projectIdMap[land.id],
  
  sellers: landSellers,
  buyers: landBuyerMap[land.id] || [],
  payment: ((paymentMap[land.id] || [])[0] && {
    ...paymentMap[land.id][0],
    payment_a: format2Decimal(paymentMap[land.id][0].payment_a),
    payment_b: format2Decimal(paymentMap[land.id][0].payment_b),
    payable_amount: format2Decimal(paymentMap[land.id][0].payable_amount),
    compensation_payment: format2Decimal(paymentMap[land.id][0].compensation_payment),
  }) || null,
  all_payments: (paymentMap[land.id] || []).map((p) => ({
    ...p,
    payment_a: format2Decimal(p.payment_a),
    payment_b: format2Decimal(p.payment_b),
    payable_amount: format2Decimal(p.payable_amount),
    compensation_payment: format2Decimal(p.compensation_payment),
  })),
  
  conversion,
  land_kyc: landKycMap[land.id] || [],


conversion_attachments: conversion
  ? conversionAttachMap[conversion.id] || []
  : [],

  rera: reraMap[land.id] || null,
  land_attachments: landAttachMap[land.id] || [],
};


    });

   return res.json({
  success: true,
  message: "Properties fetched successfully",
  total_records,
  current_page: currentPage,
  total_pages: Math.ceil(total_records / perPage),
  limit: perPage,
  data,
});

  } catch (error) {
    console.error("❌ PropertiesList error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};









exports.searchProperties = async (req, res) => {
  try {
    let { q } = req.body;

     console.log(q)
    q = q ? q.trim() : "";

    let searchText = `%${q}%`;

    // 1️⃣ Physical Possession (only id + physical_possession_status)
    const physicalQuery = `
      SELECT 
        pp.id,
        pp.physical_possession_status
      FROM properties_payment AS pp
      WHERE 
        ( ? = "" AND pp.physical_possession_status IS NOT NULL AND pp.physical_possession_status != "" )
        OR
        ( ? != "" AND pp.physical_possession_status LIKE ? )
      ORDER BY pp.id DESC
    `;

    const physicalResults = await db.fetchQuery(physicalQuery, [q, q, searchText]) || [];

    // 2️⃣ Land Category (only id + land_category)
    const categoryQuery = `
      SELECT 
        pp.id,
        pp.land_category
      FROM properties_payment AS pp
      WHERE 
        ( ? = "" AND pp.land_category IS NOT NULL AND pp.land_category != "" )
        OR
        ( ? != "" AND pp.land_category LIKE ? )
      ORDER BY pp.id DESC
    `;

    const categoryResults = await db.fetchQuery(categoryQuery, [q, q, searchText]) || [];

    // 3️⃣ Mutation / Jamabandi / Girdawari (only id + mutation_jamabandi_girdawari)
    const mutationQuery = `
      SELECT 
        pp.id,
        l.mutation_jamabandi_girdawari
      FROM properties_payment AS pp
      LEFT JOIN land AS l ON l.id = pp.land_id
      WHERE 
        ( ? = "" AND l.mutation_jamabandi_girdawari IS NOT NULL AND l.mutation_jamabandi_girdawari != "" )
        OR
        ( ? != "" AND l.mutation_jamabandi_girdawari LIKE ? )
      ORDER BY pp.id DESC
    `;

    const mutationResults = await db.fetchQuery(mutationQuery, [q, q, searchText]) || [];

    return res.json({
      success: true,
      physicalResults,
      categoryResults,
      mutationResults
    });

  } catch (error) {
    console.error("SEARCH API ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Search failed"
    });
  }
};






exports.PropertiesDelete = async (req, res) => {
  try {
    // land_id body se aa raha hai (ya params se bhejna ho to bhi easy hai)
    const { land_id } = req.body;

    if (!land_id) {
      return res.status(400).json({
        success: false,
        message: "land_id is required",
      });
    }

    const now = new Date();
    const formattedDateTime = now.toISOString().slice(0, 19).replace("T", " ");

    // 1) Land exist check (aur already deleted nahi hai)
   const landRows = await db.fetchQuery(
  `SELECT * FROM land
   WHERE (deleted_at IS NULL OR deleted_at = '0000-00-00 00:00:00')
     AND (is_married = 0 OR is_married IS NULL)
   ORDER BY id DESC`,
  []
);


    if (!landRows.length) {
      return res.status(404).json({
        success: false,
        message: "Property not found or already deleted",
      });
    }

    // ========= CONVERSION_DETAILS + CONVERSION_ATTACHMENTS =========
    const convRows = await db.fetchQuery(
      `SELECT id FROM conversion_details 
       WHERE land_id = ? AND deleted_at IS NULL`,
      [land_id]
    );

    const convIds = convRows.map((r) => r.id);

    if (convIds.length) {
      // conversion_attachments soft delete
      await db.fetchQuery(
        `UPDATE conversion_attachments
         SET deleted_at = ?
         WHERE conversion_id IN (${convIds.join(",")})`,
        [formattedDateTime]
      );

      // conversion_details soft delete
      await db.fetchQuery(
        `UPDATE conversion_details
         SET deleted_at = ?, updated_at = ?
         WHERE id IN (${convIds.join(",")})`,
        [formattedDateTime, formattedDateTime]
      );
    }

    // ================== properties_payment ==================
    await db.fetchQuery(
      `UPDATE properties_payment
       SET deleted_at = ?, updated_at = ?
       WHERE land_id = ?`,
      [formattedDateTime, formattedDateTime, land_id]
    );

    // ================== RERA_ALLOTMENT ==================
    await db.fetchQuery(
      `UPDATE rera_allotment
       SET deleted_at = ?, updated_at = ?
       WHERE land_id = ?`,
      [formattedDateTime, formattedDateTime, land_id]
    );

    // ================== LAND_ATTACHMENTS ==================
    await db.fetchQuery(
      `UPDATE land_attachments
       SET is_deleted = 1
       WHERE land_id = ?`,
      [land_id]
    );

    // ================== LAND (MAIN RECORD) ==================
    await db.fetchQuery(
      `UPDATE land
       SET deleted_at = ?
       WHERE id = ?`,
      [formattedDateTime, land_id]
    );

    return res.json({
      success: true,
      message: "Property deleted successfully",
      data: { land_id },
    });
  } catch (error) {
    console.error("❌ Error in PropertiesDelete:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while deleting property",
    });
  }
};


exports.PropertiesMerge = async (req, res) => {
  const { target_land_id, source_land_ids } = req.body;


  const projectRows = await db.fetchQuery(
    `SELECT ra.land_id, ra.project_id
     FROM rera_allotment ra
     JOIN projects p ON p.project_id = ra.project_id
     WHERE ra.land_id IN (${[target_land_id, ...source_land_ids].join(',')})
       AND p.is_delete = 0`
  );
  
  if (projectRows.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Project already created for this land. Merge is not allowed."
    });
  }
  

  if (
    !target_land_id ||
    !Array.isArray(source_land_ids) ||
    source_land_ids.length < 2
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid data'
    });
  }

  // target ko hata ke sirf source lands
  const sourceIds = source_land_ids.filter(
    (id) => Number(id) !== Number(target_land_id)
  );

  try {
    /* ===============================
       1️⃣ TARGET LAND ka PRIMARY SELLER
    =============================== */
    const [targetLand] = await db.fetchQuery(
      `SELECT seller_id
       FROM land
       WHERE id = ? AND deleted_at IS NULL`,
      [target_land_id]
    );

    if (!targetLand?.seller_id) {
      return res.status(400).json({
        success: false,
        message: 'Target land seller not found'
      });
    }

    const targetSellerId = targetLand.seller_id;

    /* ===============================
       2️⃣ SOURCE SELLERS
    =============================== */
    const sourceSellers = await db.fetchQuery(
      `SELECT id
       FROM sellers
       WHERE land_id IN (${sourceIds.join(',')})
       AND deleted_at IS NULL`
    );

    if (sourceSellers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No source sellers found'
      });
    }

    const sourceSellerIds = sourceSellers.map((s) => s.id);

    /* ===============================
       3️⃣ BUYERS → TARGET SELLER
    =============================== */
    await db.fetchQuery(
      `UPDATE buyers
       SET seller_id = ?
       WHERE seller_id IN (${sourceSellerIds.join(',')})`,
      [targetSellerId]
    );

    /* ===============================
       4️⃣ SELLER KYC → TARGET SELLER  ✅ ADD
    =============================== */
    // await db.fetchQuery(
    //   `UPDATE seller_kyc_document
    //    SET seller_id = ?
    //    WHERE seller_id IN (${sourceSellerIds.join(',')})
    //    AND deleted_at IS NULL`,
    //   [targetSellerId]
    // );

    /* ===============================
       5️⃣ SOURCE SELLERS → TARGET LAND
       (❌ delete nahi, proper merge)
    =============================== */
    await db.fetchQuery(
      `UPDATE sellers
       SET land_id = ?
       WHERE id IN (${sourceSellerIds.join(',')})`,
      [target_land_id]
    );


    /* ===============================
   6️⃣ CONVERSION DETAILS + ATTACHMENTS MERGE
=============================== */

// 🔹 Target land conversion
const [targetConversion] = await db.fetchQuery(
  `SELECT id
   FROM conversion_details
   WHERE land_id = ? AND deleted_at IS NULL`,
  [target_land_id]
);

// 🔹 Source land conversions
const sourceConversions = await db.fetchQuery(
  `SELECT id
   FROM conversion_details
   WHERE land_id IN (${sourceIds.join(',')})
   AND deleted_at IS NULL`
);
/* ===============================
   🔸 DIVISION OF AREA → TARGET
=============================== */
if (targetConversion && sourceConversions.length) {
  const targetConversionId = targetConversion.id;

  // 1️⃣ SOURCE divisions
  const sourceDivisions = await db.fetchQuery(
    `SELECT id, type, area
     FROM division_of_area
     WHERE land_id IN (${sourceIds.join(',')})
     AND deleted_at IS NULL`
  );

  // 2️⃣ TARGET divisions
  const targetDivisions = await db.fetchQuery(
    `SELECT id, type, area
     FROM division_of_area
     WHERE land_id = ?
     AND deleted_at IS NULL`,
    [target_land_id]
  );

  

  // 3️⃣ MERGE LOGIC
  for (const src of sourceDivisions) {
    const match = targetDivisions.find(t => t.type === src.type);

    if (match) {
      // SAME TYPE → AREA PLUS
      await db.fetchQuery(
        `UPDATE division_of_area
         SET area = area + ?
         WHERE id = ?`,
        [src.area, match.id]
      );

      
    } else {
      // NEW TYPE → INSERT
      await db.fetchQuery(
        `INSERT INTO division_of_area
         (land_id, conversion_details_id, type, area, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [
          target_land_id,
          targetConversionId,
          src.type,
          src.area
        ]
      );
    }
  }

  // 4️⃣ SOURCE divisions → soft delete
  await db.fetchQuery(
    `UPDATE division_of_area
     SET deleted_at = NOW()
     WHERE land_id IN (${sourceIds.join(',')})
     AND deleted_at IS NULL`
  );

  // 🔥 5️⃣ NOW RECALCULATE converted_area (MOST IMPORTANT)
  // ✅ CORRECT converted_area merge (NOT from division_of_area)

// Target converted_area
const [targetConvRow] = await db.fetchQuery(
  `SELECT converted_area
   FROM conversion_details
   WHERE id = ?`,
  [targetConversionId]
);

// Source converted_area (ALL sources)
const sourceConvAreas = await db.fetchQuery(
  `SELECT converted_area
   FROM conversion_details
   WHERE land_id IN (${sourceIds.join(',')})
   AND deleted_at IS NULL`
);

// TOTAL = target + all sources
const totalConvertedArea =
  Number(targetConvRow?.converted_area || 0) +
  sourceConvAreas.reduce(
    (sum, r) => sum + Number(r.converted_area || 0),
    0
  );

// 🔥 UPDATE ONLY conversion_details
await db.fetchQuery(
  `UPDATE conversion_details
   SET converted_area = ?
   WHERE id = ?`,
  [totalConvertedArea, targetConversionId]
);



  const [typesRow] = await db.fetchQuery(
  `SELECT GROUP_CONCAT(DISTINCT type ORDER BY type) AS types
   FROM division_of_area
   WHERE land_id = ?
   AND deleted_at IS NULL`,
  [target_land_id]
);

await db.fetchQuery(
  `UPDATE conversion_details
   SET division_of_area = ?
   WHERE id = ?`,
  [typesRow?.types || "", targetConversionId]
);

}

if (targetConversion && sourceConversions.length) {
  const targetConversionId = targetConversion.id;
  const sourceConversionIds = sourceConversions.map(c => c.id);

  // 🔥 Conversion attachments → target conversion
  await db.fetchQuery(
    `UPDATE conversion_attachments
     SET conversion_id = ?
     WHERE conversion_id IN (${sourceConversionIds.join(',')})
     AND deleted_at IS NULL`,
    [targetConversionId]
  );

  // ✅ SOURCE CONVERSIONS → TARGET LAND_ID (ADD THIS)
await db.fetchQuery(
  `UPDATE conversion_details
   SET land_id = ?
   WHERE id IN (${sourceConversionIds.join(',')})
   AND deleted_at IS NULL`,
  [target_land_id]
);


  // 🔹 Source conversion soft delete
  await db.fetchQuery(
    `UPDATE conversion_details
     SET deleted_at = NOW()
     WHERE id IN (${sourceConversionIds.join(',')})`
  );
}


    /* ===============================
       6️⃣ SOURCE LAND ATTACHMENTS → TARGET LAND
       (MERGE + revive)
    =============================== */
    await db.fetchQuery(
      `UPDATE land_attachments
       SET land_id = ?, is_deleted = 0
       WHERE land_id IN (${sourceIds.join(',')})`,
      [target_land_id]
    );

    /* ===============================
   7️⃣ RERA ALLOTMENT → TARGET LAND
   (MERGE, delete nahi)
=============================== */
/* ===============================
   7️⃣ PAYMENTS → TARGET LAND  ✅ ADD THIS
=============================== */

await db.fetchQuery(
  `UPDATE properties_payment
   SET land_id = ?
   WHERE land_id IN (${sourceIds.join(',')})
   AND deleted_at IS NULL`,
  [target_land_id]
);


await db.fetchQuery(
  `UPDATE rera_allotment
   SET land_id = ?
   WHERE land_id IN (${sourceIds.join(',')})
   AND deleted_at IS NULL`,
  [target_land_id]
);

    /* ===============================
       7️⃣ SOURCE LAND soft delete
    =============================== */

    /* ===============================
   8️⃣ SET IS_MARRIED FLAGS
=============================== */

// 🔹 Source lands → married
await db.fetchQuery(
  `UPDATE land
   SET
     is_married = 1,
     is_married_land_id = ?
   WHERE id IN (${sourceIds.join(',')})`,
  [target_land_id]
);

// 🔹 Target land → master
await db.fetchQuery(
  `UPDATE land
   SET
     is_married = 0,
     is_married_land_id = NULL
   WHERE id = ?`,
  [target_land_id]
);

    await db.fetchQuery(
      `UPDATE land
       SET deleted_at = NOW()
       WHERE id IN (${sourceIds.join(',')})`
    );

    return res.json({
      success: true,
      message: 'Properties merged successfully'
    });
  } catch (error) {
    console.error('MERGE ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Merge failed'
    });
  }
};




exports.Test = async (req, res) => {
  // try {
  //   let { q } = req.body;

  //    console.log(q)
  //   q = q ? q.trim() : "";

  //   let searchText = `%${q}%`;

  //   // 1️⃣ Physical Possession (only id + physical_possession_status)
  //   const physicalQuery = `
  //     SELECT 
  //       pp.id,
  //       pp.physical_possession_status
  //     FROM properties_payment AS pp
  //     WHERE 
  //       ( ? = "" AND pp.physical_possession_status IS NOT NULL AND pp.physical_possession_status != "" )
  //       OR
  //       ( ? != "" AND pp.physical_possession_status LIKE ? )
  //     ORDER BY pp.id DESC
  //   `;

  //   const physicalResults = await db.fetchQuery(physicalQuery, [q, q, searchText]) || [];

  //   // 2️⃣ Land Category (only id + land_category)
  //   const categoryQuery = `
  //     SELECT 
  //       pp.id,
  //       pp.land_category
  //     FROM properties_payment AS pp
  //     WHERE 
  //       ( ? = "" AND pp.land_category IS NOT NULL AND pp.land_category != "" )
  //       OR
  //       ( ? != "" AND pp.land_category LIKE ? )
  //     ORDER BY pp.id DESC
  //   `;

  //   const categoryResults = await db.fetchQuery(categoryQuery, [q, q, searchText]) || [];

  //   // 3️⃣ Mutation / Jamabandi / Girdawari (only id + mutation_jamabandi_girdawari)
  //   const mutationQuery = `
  //     SELECT 
  //       pp.id,
  //       l.mutation_jamabandi_girdawari
  //     FROM properties_payment AS pp
  //     LEFT JOIN land AS l ON l.id = pp.land_id
  //     WHERE 
  //       ( ? = "" AND l.mutation_jamabandi_girdawari IS NOT NULL AND l.mutation_jamabandi_girdawari != "" )
  //       OR
  //       ( ? != "" AND l.mutation_jamabandi_girdawari LIKE ? )
  //     ORDER BY pp.id DESC
  //   `;

  //   const mutationResults = await db.fetchQuery(mutationQuery, [q, q, searchText]) || [];

  //   return res.json({
  //     success: true,
  //     physicalResults,
  //     categoryResults,
  //     mutationResults
  //   });

  // } catch (error) {
  //   console.error("SEARCH API ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Search failed"
    });
  // }
};
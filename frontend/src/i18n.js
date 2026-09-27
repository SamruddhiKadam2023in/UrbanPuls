import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  en: {
    translation: {
      greeting: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
      nav: { map: 'Live Map', bookings: 'Bookings', complaints: 'Complaints', yolo: 'YOLO AI', emergency: 'Emergency', dashboard: 'Dashboard', profile: 'Profile', logout: 'Logout' },
      home: {
        system_active: 'System Active',
        welcome: 'Welcome to the Traffic & Parking Management System',
        zones: 'Parking Zones', available: 'Available Slots', occupancy: 'Occupancy Rate', points: 'Reward Points',
        quick_actions: 'Quick Actions', quick_sub: 'Everything you need, one click away',
        live_zones: 'Live Parking Zones', live_sub: 'Real-time availability across',
        locations: 'locations', view_map: 'View Map →',
        redeem_msg: 'reward points!', redeem_sub: 'Redeem them for parking discounts in the Complaints section', redeem_btn: 'Redeem →',
        actions: {
          map: 'Live Map', map_desc: 'View real-time parking zones',
          bookings: 'My Bookings', bookings_desc: 'Manage your parking slots',
          report: 'Report Issue', report_desc: 'Submit geo-tagged complaints',
          yolo: 'YOLO Detection', yolo_desc: 'AI-powered violation detection',
          emergency: 'Emergency', emergency_desc: 'One-tap emergency services',
          analytics: 'Analytics', analytics_desc: 'Traffic insights & admin panel',
        },
        slot_free: 'free', per_hr: '/hr', pct_available: '% available'
      },
      map: { search: 'Search parking zone...', slots_free: 'slots free', heat: 'Traffic Heat', map_view: '🗺 Map', list_view: '📋 List', available: 'Available', full: 'Full', book_now: '🅿 Book Now', no_slots: '❌ No Slots Available', zone_details: 'Zone Details', slot_avail: 'Slot Availability', peak: '🔴 Peak Hours', best: '🟢 Best Travel Time', traffic_pred: '📈 Traffic Prediction', na: 'N/A', zone_id: 'Zone ID' },
      booking: { title: 'Book Parking Slot', select_slot: 'Select Slot', time_vehicle: 'Time & Vehicle', payment: 'Payment', confirmed: 'Booking Confirmed!', available_slots: 'slots available — tap to select', no_slots: 'No slots available', all_occupied: 'All slots are currently occupied', selected_slot: 'Selected Slot', start: 'Start Time', end: 'End Time', vehicle: 'Vehicle Number', vehicle_ph: 'e.g. MH01AB1234', duration: 'Duration', rate: 'Rate', total: 'Total', review: 'Review your booking details before confirming', confirm_pay: 'Confirm & Pay ₹', processing: 'Processing...', continue: 'Continue →', back: '← Back', review_btn: 'Review Booking →', booking_id: 'Booking ID', amount_paid: 'Amount Paid', view_bookings: 'View My Bookings →', close: 'Close', demo_note: 'Payment will be processed in demo mode.' },
      bookings: { title: 'My Bookings', total: 'total bookings', no_bookings: 'No bookings yet', no_bookings_sub: 'Book a parking slot from the Live Map', vehicle: 'No vehicle number', cancel: '✕ Cancel', receipt: '⬇ Receipt', cancel_confirm: 'Cancel this booking?' },
      complaints: { title: 'Complaints', subtitle: 'Report violations and earn reward points', submit_tab: '✏️ Submit', my_tab: '📋 My Complaints', type: 'Complaint Type', description: 'Description', desc_ph: 'Describe the issue...', location: 'Location (GPS)', lat: 'Latitude', lng: 'Longitude', detect: '📍 Detect', captured: '✓ Location captured', photo: 'Photo Evidence', photo_sub: 'Supports JPG, PNG, MP4', submit_btn: '🚨 Submit Complaint', submitting: 'Submitting...', no_desc: 'No description provided', no_complaints: 'No complaints submitted yet', redeem: 'Redeem', points_label: 'points', discount: '= ₹', types: { illegal_parking: '🚫 Illegal Parking', road_blockage: '🚧 Road Blockage', signal_malfunction: '🚦 Signal Malfunction', accident: '💥 Accident', vendor_issue: '🏢 Vendor Issue' } },
      emergency: { title: 'Emergency Services', subtitle: 'One tap — direct call — works offline', note: 'These buttons make real phone calls directly to emergency services. No internet required.', native_note: 'All calls are direct native phone calls — no app server involved', police: 'Police', police_sub: 'Traffic violations & law enforcement', ambulance: 'Ambulance', ambulance_sub: 'Medical emergencies & first aid', fire: 'Fire Brigade', fire_sub: 'Fire emergencies & rescue operations', tap: 'Tap to call' },
      detection: { title: 'YOLO AI Detection', subtitle: 'Upload images for AI-powered parking violation detection', live_on: 'Live alerts active', connecting: 'Connecting...', upload_title: 'Upload Image', result_title: 'Detection Results', result_empty: 'Results will appear here after running detection', drop: 'Drag & drop or click to upload', drop_hint: 'CCTV snapshots, parking lot images', detect_btn: '🔍 Run YOLO Detection', detecting: 'Detecting...', violation: 'Violation detected — flagged for police notification', live_violations: 'Live Violations' },
      dashboard: { title: 'Dashboard', subtitle: 'Analytics, insights & admin controls', zones: 'Your Zones', bookings_total: 'Total Bookings', revenue: 'Revenue (₹)', overview: '📈 Overview', complaints_tab: '⚠️ Complaints', traffic_chart: 'Traffic Density by Zone', complaint_chart: 'Complaint Breakdown', no_traffic: 'No traffic data yet', no_complaints: 'No complaint data', pending: 'pending complaint(s) awaiting review', all_reviewed: 'All complaints have been reviewed!', verify: '✓ Verify', reject: '✕ Reject' },
      profile: { title: 'Account Details', settings: 'Settings', name: 'Full Name', email: 'Email', phone: 'Phone', role: 'Role', points: 'reward points', lang: 'Language', switch_en: 'Switch to English', switch_hi: 'Switch to हिंदी', switch_mr: 'Switch to मराठी', not_set: 'Not set', roles: { admin: 'Administrator', vendor: 'Parking Vendor', user: 'Regular User' } },
      auth: { login_title: 'Welcome back', login_sub: 'Sign in to your account to continue', email: 'Email address', password: 'Password', signing_in: 'Signing in...', sign_in: 'Sign In →', no_account: "Don't have an account?", create: 'Create one →', demo: 'Demo Credentials', register_title: 'Join TPMS', register_sub: 'Create your account in seconds', name: 'Full Name', phone: 'Phone Number', role: 'Account Role', user_role: '🚗 Regular User', vendor_role: '🏢 Parking Vendor', creating: 'Creating account...', create_btn: 'Create Account →', have_account: 'Already have an account?', sign_in_link: 'Sign in →' },
      common: { loading: 'Loading...', no_data: 'No data', hours: 'hours', free: 'free' }
    }
  },

  hi: {
    translation: {
      greeting: { morning: 'सुप्रभात', afternoon: 'नमस्कार', evening: 'शुभ संध्या' },
      nav: { map: 'लाइव मैप', bookings: 'बुकिंग', complaints: 'शिकायतें', yolo: 'YOLO AI', emergency: 'आपातकाल', dashboard: 'डैशबोर्ड', profile: 'प्रोफाइल', logout: 'लॉगआउट' },
      home: {
        system_active: 'सिस्टम सक्रिय',
        welcome: 'ट्रैफिक और पार्किंग प्रबंधन प्रणाली में आपका स्वागत है',
        zones: 'पार्किंग क्षेत्र', available: 'उपलब्ध स्लॉट', occupancy: 'अधिभोग दर', points: 'रिवॉर्ड अंक',
        quick_actions: 'त्वरित कार्रवाई', quick_sub: 'आपको जो चाहिए वो एक क्लिक में',
        live_zones: 'लाइव पार्किंग क्षेत्र', live_sub: 'रियल-टाइम उपलब्धता',
        locations: 'स्थानों पर', view_map: 'नकाशा देखें →',
        redeem_msg: 'रिवॉर्ड अंक!', redeem_sub: 'शिकायत अनुभाग में पार्किंग छूट के लिए भुनाएं', redeem_btn: 'भुनाएं →',
        actions: {
          map: 'लाइव मैप', map_desc: 'रियल-टाइम पार्किंग क्षेत्र देखें',
          bookings: 'मेरी बुकिंग', bookings_desc: 'अपनी पार्किंग स्लॉट प्रबंधित करें',
          report: 'समस्या रिपोर्ट करें', report_desc: 'जियो-टैग्ड शिकायत दर्ज करें',
          yolo: 'YOLO डिटेक्शन', yolo_desc: 'AI-आधारित उल्लंघन पहचान',
          emergency: 'आपातकाल', emergency_desc: 'एक टैप आपातकालीन सेवाएं',
          analytics: 'विश्लेषण', analytics_desc: 'ट्रैफिक जानकारी और एडमिन पैनल',
        },
        slot_free: 'खाली', per_hr: '/घंटा', pct_available: '% उपलब्ध'
      },
      map: { search: 'पार्किंग क्षेत्र खोजें...', slots_free: 'स्लॉट खाली', heat: 'ट्रैफिक हीट', map_view: '🗺 नकाशा', list_view: '📋 सूची', available: 'उपलब्ध', full: 'भरा', book_now: '🅿 अभी बुक करें', no_slots: '❌ कोई स्लॉट नहीं', zone_details: 'क्षेत्र विवरण', slot_avail: 'स्लॉट उपलब्धता', peak: '🔴 पीक घंटे', best: '🟢 सबसे अच्छा समय', traffic_pred: '📈 ट्रैफिक अनुमान', na: 'उपलब्ध नहीं', zone_id: 'क्षेत्र ID' },
      booking: { title: 'पार्किंग स्लॉट बुक करें', select_slot: 'स्लॉट चुनें', time_vehicle: 'समय और वाहन', payment: 'भुगतान', confirmed: 'बुकिंग पक्की!', available_slots: 'स्लॉट उपलब्ध — चुनने के लिए टैप करें', no_slots: 'कोई स्लॉट उपलब्ध नहीं', all_occupied: 'सभी स्लॉट भरे हैं', selected_slot: 'चुना हुआ स्लॉट', start: 'शुरुआत समय', end: 'समाप्ति समय', vehicle: 'वाहन नंबर', vehicle_ph: 'जैसे MH01AB1234', duration: 'अवधि', rate: 'दर', total: 'कुल', review: 'पुष्टि से पहले विवरण जांचें', confirm_pay: 'पुष्टि और भुगतान ₹', processing: 'प्रोसेस हो रहा है...', continue: 'जारी रखें →', back: '← वापस', review_btn: 'बुकिंग की समीक्षा →', booking_id: 'बुकिंग ID', amount_paid: 'भुगतान राशि', view_bookings: 'मेरी बुकिंग देखें →', close: 'बंद करें', demo_note: 'डेमो मोड में भुगतान होगा।' },
      bookings: { title: 'मेरी बुकिंग', total: 'कुल बुकिंग', no_bookings: 'अभी कोई बुकिंग नहीं', no_bookings_sub: 'लाइव मैप से पार्किंग स्लॉट बुक करें', vehicle: 'वाहन नंबर नहीं', cancel: '✕ रद्द करें', receipt: '⬇ रसीद', cancel_confirm: 'इस बुकिंग को रद्द करें?' },
      complaints: { title: 'शिकायतें', subtitle: 'उल्लंघन रिपोर्ट करें और रिवॉर्ड अंक पाएं', submit_tab: '✏️ दर्ज करें', my_tab: '📋 मेरी शिकायतें', type: 'शिकायत का प्रकार', description: 'विवरण', desc_ph: 'समस्या का विवरण दें...', location: 'स्थान (GPS)', lat: 'अक्षांश', lng: 'देशांतर', detect: '📍 पहचानें', captured: '✓ स्थान दर्ज', photo: 'फोटो प्रमाण', photo_sub: 'JPG, PNG, MP4 समर्थित', submit_btn: '🚨 शिकायत दर्ज करें', submitting: 'दर्ज हो रहा है...', no_desc: 'कोई विवरण नहीं', no_complaints: 'अभी कोई शिकायत नहीं', redeem: 'भुनाएं', points_label: 'अंक', discount: '= ₹', types: { illegal_parking: '🚫 अवैध पार्किंग', road_blockage: '🚧 सड़क अवरोध', signal_malfunction: '🚦 सिग्नल खराबी', accident: '💥 दुर्घटना', vendor_issue: '🏢 विक्रेता समस्या' } },
      emergency: { title: 'आपातकालीन सेवाएं', subtitle: 'एक टैप — सीधी कॉल — ऑफलाइन काम करता है', note: 'ये बटन सीधे आपातकालीन सेवाओं को फोन करते हैं। इंटरनेट की जरूरत नहीं।', native_note: 'सभी कॉल सीधे नेटिव फोन कॉल हैं', police: 'पुलिस', police_sub: 'ट्रैफिक उल्लंघन और कानून प्रवर्तन', ambulance: 'एम्बुलेंस', ambulance_sub: 'चिकित्सा आपात और प्राथमिक चिकित्सा', fire: 'दमकल', fire_sub: 'आग की आपात और बचाव कार्य', tap: 'कॉल करने के लिए टैप करें' },
      detection: { title: 'YOLO AI डिटेक्शन', subtitle: 'AI-आधारित पार्किंग उल्लंघन पहचान के लिए चित्र अपलोड करें', live_on: 'लाइव अलर्ट सक्रिय', connecting: 'कनेक्ट हो रहा है...', upload_title: 'चित्र अपलोड करें', result_title: 'पहचान परिणाम', result_empty: 'डिटेक्शन चलाने के बाद परिणाम यहां दिखेंगे', drop: 'खींचें और छोड़ें या क्लिक करें', drop_hint: 'CCTV स्नैपशॉट, पार्किंग चित्र', detect_btn: '🔍 YOLO डिटेक्शन चलाएं', detecting: 'पहचान हो रही है...', violation: 'उल्लंघन पाया — पुलिस को भेजा जा रहा है', live_violations: 'लाइव उल्लंघन' },
      dashboard: { title: 'डैशबोर्ड', subtitle: 'विश्लेषण, जानकारी और एडमिन नियंत्रण', zones: 'आपके क्षेत्र', bookings_total: 'कुल बुकिंग', revenue: 'आमदनी (₹)', overview: '📈 अवलोकन', complaints_tab: '⚠️ शिकायतें', traffic_chart: 'क्षेत्र अनुसार ट्रैफिक घनत्व', complaint_chart: 'शिकायत विवरण', no_traffic: 'अभी कोई ट्रैफिक डेटा नहीं', no_complaints: 'कोई शिकायत डेटा नहीं', pending: 'शिकायतें समीक्षा की प्रतीक्षा में', all_reviewed: 'सभी शिकायतें समीक्षित!', verify: '✓ सत्यापित', reject: '✕ अस्वीकार' },
      profile: { title: 'खाता विवरण', settings: 'सेटिंग', name: 'पूरा नाम', email: 'ईमेल', phone: 'फोन', role: 'भूमिका', points: 'रिवॉर्ड अंक', lang: 'भाषा', switch_en: 'English पर बदलें', switch_hi: 'हिंदी पर बदलें', switch_mr: 'मराठी पर बदलें', not_set: 'सेट नहीं', roles: { admin: 'प्रशासक', vendor: 'पार्किंग विक्रेता', user: 'सामान्य उपयोगकर्ता' } },
      auth: { login_title: 'वापसी पर स्वागत है', login_sub: 'जारी रखने के लिए साइन इन करें', email: 'ईमेल पता', password: 'पासवर्ड', signing_in: 'साइन इन हो रहा है...', sign_in: 'साइन इन →', no_account: 'खाता नहीं है?', create: 'बनाएं →', demo: 'डेमो क्रेडेंशियल', register_title: 'TPMS से जुड़ें', register_sub: 'सेकंड में खाता बनाएं', name: 'पूरा नाम', phone: 'फोन नंबर', role: 'खाता भूमिका', user_role: '🚗 सामान्य उपयोगकर्ता', vendor_role: '🏢 पार्किंग विक्रेता', creating: 'खाता बन रहा है...', create_btn: 'खाता बनाएं →', have_account: 'पहले से खाता है?', sign_in_link: 'साइन इन →' },
      common: { loading: 'लोड हो रहा है...', no_data: 'कोई डेटा नहीं', hours: 'घंटे', free: 'खाली' }
    }
  },

  mr: {
    translation: {
      greeting: { morning: 'सुप्रभात', afternoon: 'नमस्कार', evening: 'शुभ संध्याकाळ' },
      nav: { map: 'थेट नकाशा', bookings: 'बुकिंग', complaints: 'तक्रारी', yolo: 'YOLO AI', emergency: 'आणीबाणी', dashboard: 'डॅशबोर्ड', profile: 'प्रोफाइल', logout: 'बाहेर पडा' },
      home: {
        system_active: 'प्रणाली सक्रिय',
        welcome: 'वाहतूक आणि पार्किंग व्यवस्थापन प्रणालीत आपले स्वागत',
        zones: 'पार्किंग क्षेत्रे', available: 'उपलब्ध जागा', occupancy: 'अधिभोग दर', points: 'बक्षीस गुण',
        quick_actions: 'जलद क्रिया', quick_sub: 'तुम्हाला जे हवे ते एका क्लिकवर',
        live_zones: 'थेट पार्किंग क्षेत्रे', live_sub: 'रिअल-टाइम उपलब्धता',
        locations: 'ठिकाणांवर', view_map: 'नकाशा पाहा →',
        redeem_msg: 'बक्षीस गुण!', redeem_sub: 'तक्रारी विभागात पार्किंग सवलतीसाठी वापरा', redeem_btn: 'वापरा →',
        actions: {
          map: 'थेट नकाशा', map_desc: 'रिअल-टाइम पार्किंग क्षेत्रे पाहा',
          bookings: 'माझ्या बुकिंग', bookings_desc: 'पार्किंग जागा व्यवस्थापित करा',
          report: 'समस्या नोंदवा', report_desc: 'जिओ-टॅग्ड तक्रार नोंदवा',
          yolo: 'YOLO शोध', yolo_desc: 'AI-आधारित उल्लंघन शोध',
          emergency: 'आणीबाणी', emergency_desc: 'एक टॅप आणीबाणी सेवा',
          analytics: 'विश्लेषण', analytics_desc: 'वाहतूक माहिती आणि प्रशासन',
        },
        slot_free: 'रिकामे', per_hr: '/तास', pct_available: '% उपलब्ध'
      },
      map: { search: 'पार्किंग क्षेत्र शोधा...', slots_free: 'जागा रिकाम्या', heat: 'वाहतूक हीट', map_view: '🗺 नकाशा', list_view: '📋 यादी', available: 'उपलब्ध', full: 'भरलेले', book_now: '🅿 आत्ता बुक करा', no_slots: '❌ जागा नाही', zone_details: 'क्षेत्र तपशील', slot_avail: 'जागा उपलब्धता', peak: '🔴 व्यस्त वेळ', best: '🟢 सर्वोत्तम वेळ', traffic_pred: '📈 वाहतूक अंदाज', na: 'उपलब्ध नाही', zone_id: 'क्षेत्र ID' },
      booking: { title: 'पार्किंग जागा बुक करा', select_slot: 'जागा निवडा', time_vehicle: 'वेळ आणि वाहन', payment: 'पेमेंट', confirmed: 'बुकिंग पक्की!', available_slots: 'जागा उपलब्ध — निवडण्यासाठी टॅप करा', no_slots: 'जागा उपलब्ध नाही', all_occupied: 'सर्व जागा भरल्या आहेत', selected_slot: 'निवडलेली जागा', start: 'सुरुवातीची वेळ', end: 'समाप्तीची वेळ', vehicle: 'वाहन क्रमांक', vehicle_ph: 'उदा. MH01AB1234', duration: 'कालावधी', rate: 'दर', total: 'एकूण', review: 'पुष्टी करण्यापूर्वी तपशील तपासा', confirm_pay: 'पुष्टी आणि पेमेंट ₹', processing: 'प्रक्रिया होत आहे...', continue: 'पुढे जा →', back: '← मागे', review_btn: 'बुकिंग तपासा →', booking_id: 'बुकिंग ID', amount_paid: 'भरलेली रक्कम', view_bookings: 'माझ्या बुकिंग पाहा →', close: 'बंद करा', demo_note: 'डेमो मोडमध्ये पेमेंट होईल.' },
      bookings: { title: 'माझ्या बुकिंग', total: 'एकूण बुकिंग', no_bookings: 'अजून बुकिंग नाही', no_bookings_sub: 'थेट नकाशातून पार्किंग जागा बुक करा', vehicle: 'वाहन क्रमांक नाही', cancel: '✕ रद्द करा', receipt: '⬇ पावती', cancel_confirm: 'ही बुकिंग रद्द करायची?' },
      complaints: { title: 'तक्रारी', subtitle: 'उल्लंघन नोंदवा आणि बक्षीस गुण मिळवा', submit_tab: '✏️ नोंदवा', my_tab: '📋 माझ्या तक्रारी', type: 'तक्रारीचा प्रकार', description: 'वर्णन', desc_ph: 'समस्येचे वर्णन करा...', location: 'स्थान (GPS)', lat: 'अक्षांश', lng: 'रेखांश', detect: '📍 शोधा', captured: '✓ स्थान नोंदले', photo: 'फोटो पुरावा', photo_sub: 'JPG, PNG, MP4 समर्थित', submit_btn: '🚨 तक्रार नोंदवा', submitting: 'नोंदवत आहे...', no_desc: 'वर्णन नाही', no_complaints: 'अजून कोणती तक्रार नाही', redeem: 'वापरा', points_label: 'गुण', discount: '= ₹', types: { illegal_parking: '🚫 बेकायदेशीर पार्किंग', road_blockage: '🚧 रस्ता अडथळा', signal_malfunction: '🚦 सिग्नल बिघाड', accident: '💥 अपघात', vendor_issue: '🏢 विक्रेता समस्या' } },
      emergency: { title: 'आणीबाणी सेवा', subtitle: 'एक टॅप — थेट कॉल — ऑफलाइन काम करते', note: 'हे बटण थेट आणीबाणी सेवांना फोन करतात. इंटरनेट लागत नाही.', native_note: 'सर्व कॉल थेट नेटिव्ह फोन कॉल आहेत', police: 'पोलीस', police_sub: 'वाहतूक उल्लंघन आणि कायदा', ambulance: 'रुग्णवाहिका', ambulance_sub: 'वैद्यकीय आणीबाणी', fire: 'अग्निशमन दल', fire_sub: 'आग आणीबाणी आणि बचाव', tap: 'कॉल करण्यासाठी टॅप करा' },
      detection: { title: 'YOLO AI शोध', subtitle: 'AI-आधारित पार्किंग उल्लंघन शोधासाठी चित्र अपलोड करा', live_on: 'थेट अलर्ट सक्रिय', connecting: 'कनेक्ट होत आहे...', upload_title: 'चित्र अपलोड करा', result_title: 'शोध निकाल', result_empty: 'शोध चालवल्यानंतर निकाल येथे दिसतील', drop: 'ड्रॅग करा किंवा क्लिक करा', drop_hint: 'CCTV स्नॅपशॉट, पार्किंग चित्रे', detect_btn: '🔍 YOLO शोध चालवा', detecting: 'शोधत आहे...', violation: 'उल्लंघन आढळले — पोलिसांना पाठवले जात आहे', live_violations: 'थेट उल्लंघने' },
      dashboard: { title: 'डॅशबोर्ड', subtitle: 'विश्लेषण, माहिती आणि प्रशासन नियंत्रण', zones: 'तुमची क्षेत्रे', bookings_total: 'एकूण बुकिंग', revenue: 'महसूल (₹)', overview: '📈 आढावा', complaints_tab: '⚠️ तक्रारी', traffic_chart: 'क्षेत्रानुसार वाहतूक घनता', complaint_chart: 'तक्रार तपशील', no_traffic: 'अजून वाहतूक डेटा नाही', no_complaints: 'तक्रार डेटा नाही', pending: 'तक्रारी पुनरावलोकनाच्या प्रतीक्षेत', all_reviewed: 'सर्व तक्रारी पुनरावलोकन झाल्या!', verify: '✓ सत्यापित', reject: '✕ नाकारा' },
      profile: { title: 'खाते तपशील', settings: 'सेटिंग्ज', name: 'पूर्ण नाव', email: 'ईमेल', phone: 'फोन', role: 'भूमिका', points: 'बक्षीस गुण', lang: 'भाषा', switch_en: 'English वर बदला', switch_hi: 'हिंदी वर बदला', switch_mr: 'मराठी वर बदला', not_set: 'सेट नाही', roles: { admin: 'प्रशासक', vendor: 'पार्किंग विक्रेता', user: 'सामान्य वापरकर्ता' } },
      auth: { login_title: 'परत स्वागत आहे', login_sub: 'सुरू ठेवण्यासाठी साइन इन करा', email: 'ईमेल पत्ता', password: 'पासवर्ड', signing_in: 'साइन इन होत आहे...', sign_in: 'साइन इन →', no_account: 'खाते नाही?', create: 'बनवा →', demo: 'डेमो क्रेडेन्शियल', register_title: 'TPMS मध्ये सामील व्हा', register_sub: 'सेकंदात खाते बनवा', name: 'पूर्ण नाव', phone: 'फोन नंबर', role: 'खाते भूमिका', user_role: '🚗 सामान्य वापरकर्ता', vendor_role: '🏢 पार्किंग विक्रेता', creating: 'खाते बनवत आहे...', create_btn: 'खाते बनवा →', have_account: 'आधीच खाते आहे?', sign_in_link: 'साइन इन →' },
      common: { loading: 'लोड होत आहे...', no_data: 'डेटा नाही', hours: 'तास', free: 'रिकामे' }
    }
  }
}

i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem('lang') || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
})

export default i18n

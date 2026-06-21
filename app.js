/**
 * SuryaNex Renewables - Frontend Interactions
 * Location: Rajahmundry, Andhra Pradesh
 */

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. PRELOADER FADEOUT
  const preloader = document.getElementById('preloader');
  if (preloader) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        preloader.style.opacity = '0';
        preloader.style.visibility = 'hidden';
      }, 300);
    });
  }

  // 2. STICKY HEADER & SCROLL TINTS
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // 3. MOBILE HAMBURGER MENU DRAWER
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navLinksMenu = document.getElementById('nav-links-menu');
  const navLinksList = document.querySelectorAll('.nav-link-item');

  hamburgerBtn.addEventListener('click', () => {
    hamburgerBtn.classList.toggle('active');
    navLinksMenu.classList.toggle('active');
  });

  // Close menu when links are clicked (for smooth scroll)
  navLinksList.forEach(link => {
    link.addEventListener('click', () => {
      hamburgerBtn.classList.remove('active');
      navLinksMenu.classList.remove('active');
    });
  });

  // 4. ACTIVE SECTION SCROLL SPY
  const sections = document.querySelectorAll('section[id], header');
  const navItems = document.querySelectorAll('.nav-link-item');

  window.addEventListener('scroll', () => {
    let currentId = '';
    const scrollPos = window.scrollY + 120; // offset for nav header height

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        currentId = section.getAttribute('id');
      }
    });

    navItems.forEach(item => {
      item.classList.remove('active');
      const href = item.getAttribute('href');
      if (href === `#${currentId}`) {
        item.classList.add('active');
      }
    });
  });

  // 5. SOLAR SAVINGS CALCULATOR LOGIC
  const billSlider = document.getElementById('bill-slider');
  const spaceSlider = document.getElementById('space-slider');
  const billDisplay = document.getElementById('bill-display');
  const spaceDisplay = document.getElementById('space-display');
  
  const sectorRes = document.getElementById('sector-res');
  const sectorCom = document.getElementById('sector-com');
  const resCapacity = document.getElementById('res-capacity');
  const resSpace = document.getElementById('res-space');
  const resGross = document.getElementById('res-gross');
  const resSubsidy = document.getElementById('res-subsidy');
  const resNet = document.getElementById('res-net');
  const resYearlySavings = document.getElementById('res-yearly-savings');
  const resPayback = document.getElementById('res-payback');

  const subCentral = document.getElementById('sub-central');
  const subState = document.getElementById('sub-state');
  const subTotal = document.getElementById('sub-total');
  const subsidyCardWrapper = document.getElementById('subsidy-card-wrapper');

  const contactBillEstimate = document.getElementById('bill-estimate');
  const contactCapacityEstimate = document.getElementById('capacity-estimate');
  const contactSectorSelect = document.getElementById('sector-select');

  let selectedSector = 'residential'; // default

  // Calculator logic
  function calculateSolar(e) {
    const monthlyBill = parseInt(billSlider.value);
    let roofSpace = parseInt(spaceSlider.value);

    // 1. Calculate Required Capacity from Bill
    // A 1kW solar panels set generates ~120 units/month in Rajahmundry.
    // Average unit cost in AP slab ranges. Let's estimate ₹8 per unit average.
    // Required kW = (monthlyBill / 8) / 120 = monthlyBill / 960
    let kwNeeded = monthlyBill / 960;
    kwNeeded = Math.round(kwNeeded * 2) / 2; // round to nearest 0.5 kW
    if (kwNeeded < 1) kwNeeded = 1.0;
    if (kwNeeded > 50) kwNeeded = 50.0;

    // 2. Handle synchronization between Sliders
    // If the event came from the bill slider (or initial run), auto-adjust space slider to match capacity
    if (!e || e.target.id === 'bill-slider') {
      const suggestedSpace = kwNeeded * 100;
      spaceSlider.value = Math.min(suggestedSpace, 2500);
      roofSpace = parseInt(spaceSlider.value);
    }

    // 3. Cap capacity if roof space is insufficient (1 kW = 100 sq ft)
    const maxKwBySpace = Math.floor((roofSpace / 100) * 2) / 2;
    let recommendedKw = kwNeeded;
    let spaceWarning = false;

    if (recommendedKw > maxKwBySpace) {
      recommendedKw = Math.max(1.0, maxKwBySpace);
      spaceWarning = true;
    }

    const spaceNeeded = recommendedKw * 100;

    // Update value displays
    billDisplay.textContent = `₹${monthlyBill.toLocaleString('en-IN')}`;
    
    if (spaceWarning) {
      spaceDisplay.style.color = '#ef4444';
      spaceDisplay.innerHTML = `${roofSpace} Sq. Ft. <span style="font-size:0.75rem; display:block; color:#ef4444; font-weight:600;">(Space limits system size)</span>`;
    } else {
      spaceDisplay.style.color = 'var(--primary)';
      spaceDisplay.textContent = `${roofSpace} Sq. Ft.`;
    }

    // 4. Compute costs
    // Average installation cost is ₹60,000 per kW gross
    const grossCost = recommendedKw * 60000;

    // 5. Calculate Subsidy (PM Surya Ghar rules: residential only)
    let centralSubsidy = 0;
    if (selectedSector === 'residential') {
      if (recommendedKw >= 3.0) {
        centralSubsidy = 78000; // Flat max subsidy
      } else if (recommendedKw >= 2.0) {
        centralSubsidy = 60000 + (recommendedKw - 2.0) * 18000;
        if (centralSubsidy > 78000) centralSubsidy = 78000;
      } else {
        centralSubsidy = 30000 + (recommendedKw - 1.0) * 30000;
      }
    }

    const stateSubsidy = 0; // AP has no extra matching state subsidy besides central CFA currently
    const totalSubsidy = centralSubsidy + stateSubsidy;
    const netCost = grossCost - totalSubsidy;

    // 6. Yearly Savings (solar covers up to 90% of electricity bill, limited by generated capacity)
    const maxYearlySavingsFromSolar = recommendedKw * 120 * 8 * 12;
    const standardSavingsFromBill = monthlyBill * 12 * 0.90;
    const yearlySavingsVal = Math.round(Math.min(standardSavingsFromBill, maxYearlySavingsFromSolar));

    // 7. Payback period (Net investment / Yearly savings)
    const paybackVal = yearlySavingsVal > 0 ? (netCost / yearlySavingsVal).toFixed(1) : '0.0';

    // Update DOM
    resCapacity.textContent = `${recommendedKw.toFixed(1)} kW`;
    resSpace.textContent = `${spaceNeeded} Sq. Ft.`;
    resGross.textContent = `₹${grossCost.toLocaleString('en-IN')}`;
    resSubsidy.textContent = `₹${totalSubsidy.toLocaleString('en-IN')}`;
    resNet.textContent = `₹${netCost.toLocaleString('en-IN')}`;
    resYearlySavings.textContent = `₹${yearlySavingsVal.toLocaleString('en-IN')}`;
    resPayback.textContent = `${paybackVal} Years`;

    // Update Subsidy Cards
    subCentral.textContent = `₹${centralSubsidy.toLocaleString('en-IN')}`;
    subState.textContent = `₹${stateSubsidy.toLocaleString('en-IN')}`;
    subTotal.textContent = `₹${totalSubsidy.toLocaleString('en-IN')}`;

    if (selectedSector === 'commercial') {
      subsidyCardWrapper.style.opacity = '0.4';
      subTotal.textContent = 'Not Eligible';
    } else {
      subsidyCardWrapper.style.opacity = '1';
    }

    // 8. Environmental Impact Calculations
    const co2SavingsVal = (recommendedKw * 0.8).toFixed(1);
    const treesVal = Math.round(recommendedKw * 36);
    const co2SavingDisplay = document.getElementById('co2-saving-val');
    const treesDisplay = document.getElementById('trees-val');
    if (co2SavingDisplay) co2SavingDisplay.textContent = co2SavingsVal;
    if (treesDisplay) treesDisplay.textContent = treesVal;

    // Sync to contact form inputs so the user sends their actual computed quote
    contactBillEstimate.value = `₹${monthlyBill.toLocaleString('en-IN')} / month`;
    contactCapacityEstimate.value = `${recommendedKw.toFixed(1)} kW System`;
  }

  // Calculator Event Listeners
  if (billSlider && spaceSlider) {
    billSlider.addEventListener('input', (e) => calculateSolar(e));
    spaceSlider.addEventListener('input', (e) => calculateSolar(e));

    sectorRes.addEventListener('click', () => {
      sectorRes.classList.add('active');
      sectorCom.classList.remove('active');
      selectedSector = 'residential';
      contactSectorSelect.value = 'residential';
      calculateSolar();
    });

    sectorCom.addEventListener('click', () => {
      sectorCom.classList.add('active');
      sectorRes.classList.remove('active');
      selectedSector = 'commercial';
      contactSectorSelect.value = 'commercial';
      calculateSolar();
    });

    contactSectorSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'residential') {
        sectorRes.click();
      } else {
        sectorCom.click();
      }
    });

    // Initial run
    calculateSolar();
  }

  // 6. ASYNCHRONOUS CONTACT FORM HANDLER (WITH LOCAL FALLBACK)
  const contactForm = document.getElementById('solar-contact-form');
  const formResult = document.getElementById('form-result');

  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      formResult.className = 'form-message';
      formResult.textContent = 'Submitting your request, please wait...';
      formResult.style.display = 'block';

      // Gather form data
      const formData = {
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value,
        bill_estimate: contactBillEstimate.value,
        sector: contactSectorSelect.value,
        capacity_estimate: contactCapacityEstimate.value,
        message: document.getElementById('message').value
      };

      try {
        // Send request to FastAPI backend
        const response = await fetch('http://127.0.0.1:8000/api/quote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });

        if (response.ok) {
          const resJson = await response.json();
          formResult.className = 'form-message success';
          formResult.textContent = `Thank you, ${formData.name}! Your request has been logged successfully (ID: ${resJson.id || 'N/A'}). We will call you back shortly.`;
          contactForm.reset();
          // Reset slider estimates
          calculateSolar();
        } else {
          throw new Error('Server returned an error status.');
        }
      } catch (error) {
        console.warn('Backend connection failed. Falling back to client-side storage simulation.', error);
        
        // Local simulation fallback
        setTimeout(() => {
          // Store locally in localStorage for testing
          const localQuotes = JSON.parse(localStorage.getItem('solar_quotes') || '[]');
          localQuotes.push({
            ...formData,
            timestamp: new Date().toISOString(),
            id: 'MOCK-' + Math.floor(Math.random() * 10000)
          });
          localStorage.setItem('solar_quotes', JSON.stringify(localQuotes));

          formResult.className = 'form-message success';
          formResult.textContent = `Thank you, ${formData.name}! Your query was simulated & saved locally in browser storage. (Note: Optional FastAPI backend is currently offline). We will contact you soon!`;
          contactForm.reset();
          calculateSolar();
        }, 1200);
      }
    });
  }

  // 7. NEWSLETTER FORM HANDLER
  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = newsletterForm.querySelector('input');
      const email = emailInput.value;
      
      alert(`Successfully subscribed ${email} to SuryaNex Renewables updates!`);
      newsletterForm.reset();
    });
  }

  // 8. THEME SWITCHER LOGIC
  const themeToggleBtn = document.getElementById('theme-toggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const activeTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = activeTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  }
});

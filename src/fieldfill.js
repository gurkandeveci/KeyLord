// Şifre alanı doldurma: sayfadaki uygun şifre alanlarına üretilen şifreyi yazar.
// Güvenlik kuralı: şifre olmayan ya da zaten değeri olan alana asla yazılmaz.
// pickTargets saf fonksiyondur (DOM gerektirmez); DOM'a yalnızca fillPassword dokunur.
(function (g) {
  'use strict';
  if (g.KeyLordFieldFill) return; // çift yükleme koruması

  function eligible(f) {
    return !!(f && f.isPassword && f.empty && f.visible && f.editable);
  }

  // fields[i] = { isPassword, empty, visible, editable }; doldurulacak indeksleri döner.
  // Odaklı alan uygunsa: [odaklı, ondan sonraki ilk uygun (varsa)]; değilse tüm uygunlar.
  function pickTargets(fields, focusedIndex) {
    var list = fields || [];
    var all = [];
    for (var i = 0; i < list.length; i++) if (eligible(list[i])) all.push(i);
    if (typeof focusedIndex === 'number' && focusedIndex >= 0 && eligible(list[focusedIndex])) {
      var out = [focusedIndex];
      for (var j = 0; j < all.length; j++) {
        if (all[j] > focusedIndex) {
          out.push(all[j]);
          break;
        }
      }
      return out;
    }
    return all;
  }

  // Sayfadaki input'ları tarar, uygun olanları doldurur; doldurulan sayıyı döner.
  // Şifre asla log'lanmaz.
  function fillPassword(doc, focusedEl, password) {
    var win = doc.defaultView;
    var inputs = Array.prototype.slice.call(doc.querySelectorAll('input'));
    var fields = inputs.map(function (el) {
      var type = (el.getAttribute('type') || '').toLowerCase();
      var visible = el.getClientRects().length > 0 && win.getComputedStyle(el).visibility !== 'hidden';
      return {
        isPassword: type === 'password',
        empty: el.value === '',
        visible: visible,
        editable: !el.disabled && !el.readOnly
      };
    });
    var targets = pickTargets(fields, inputs.indexOf(focusedEl));
    // Çerçeve (React vb.) değer izleyicisini atlamak için yerel setter kullanılır.
    var setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set;
    targets.forEach(function (idx) {
      var el = inputs[idx];
      setter.call(el, password);
      el.dispatchEvent(new win.Event('input', { bubbles: true }));
      el.dispatchEvent(new win.Event('change', { bubbles: true }));
    });
    return targets.length;
  }

  g.KeyLordFieldFill = { pickTargets: pickTargets, fillPassword: fillPassword };
})(globalThis);

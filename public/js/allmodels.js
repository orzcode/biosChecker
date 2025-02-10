// Helper script
// filters the table based on the selected socket
document.addEventListener("DOMContentLoaded", function () {
	const checkboxes = document.querySelectorAll('.socket-checkbox');
	const tableRows = document.querySelectorAll('#motherboard-table tbody tr'); // all the rows in the table
  
	checkboxes.forEach((checkbox) => {
	  checkbox.addEventListener('change', function () {
		// Unchecks all other checkboxes when you click on one
		// (eg: one checkbox at a time)
		checkboxes.forEach((otherCheckbox) => {
		  if (otherCheckbox !== checkbox) {
			otherCheckbox.checked = false;
		  }
		});
  
		// Filters the table based on the ticked box (function below)
		// In short - this is 'attached' to each of the 4 checkboxes
		filterTable();
	  });
	});
  
	function filterTable() {
	  const selectedSockets = Array.from(checkboxes)
		.filter((checkbox) => checkbox.checked)
		.map((checkbox) => checkbox.value);
  
	  tableRows.forEach((row) => {
		const socketType = row.getAttribute('data-row');
		//See EJS view if needed - basically, each row has a data-row attribute
  
		// Checks if the row matches the selected socket
		if (selectedSockets.length === 0 || selectedSockets.includes(socketType)) {
		  row.style.display = ''; // Shows row if it matches
		} else {
		  row.style.display = 'none'; // Hides row if it doesn't
		}
	  });
	}
  });
  
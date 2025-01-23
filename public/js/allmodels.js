// This script is used to filter the table based on the selected checkboxes
//
document.addEventListener("DOMContentLoaded", function () {
	const checkboxes = document.querySelectorAll('.socket-checkbox');
	const tableRows = document.querySelectorAll('#motherboard-table tbody tr'); // all the rows in the table
  
	checkboxes.forEach((checkbox) => {
	  checkbox.addEventListener('change', function () {
		// When one checkbox is clicked, uncheck all others
		checkboxes.forEach((otherCheckbox) => {
		  if (otherCheckbox !== checkbox) {
			otherCheckbox.checked = false;
		  }
		});
  
		// Filter the table based on the selected checkbox
		filterTable();
	  });
	});
  
	function filterTable() {
	  const selectedSockets = Array.from(checkboxes)
		.filter((checkbox) => checkbox.checked)
		.map((checkbox) => checkbox.value); // Get selected socket values
  
	  tableRows.forEach((row) => {
		const socketType = row.getAttribute('data-row'); // Get socket type from each row's data attribute
  
		// Check if the row matches the selected socket
		if (selectedSockets.length === 0 || selectedSockets.includes(socketType)) {
		  row.style.display = ''; // Show row if it matches the selected socket
		} else {
		  row.style.display = 'none'; // Hide row if it doesn't match
		}
	  });
	}
  });
  